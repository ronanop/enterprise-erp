"""ESS Instagram-style workplace feed — posts, media, likes, comments."""

from __future__ import annotations

import base64
import binascii
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ForbiddenException, NotFoundException
from modules.ess.feed_storage import (
    MAX_PHOTOS_PER_POST,
    MAX_VIDEO_SECONDS,
    load_feed_media_download,
    save_feed_media_bytes,
)
from modules.ess.schemas import (
    EssFeedCommentCreate,
    EssFeedCommentItem,
    EssFeedMediaItem,
    EssFeedPostCreate,
    EssFeedPostItem,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.ess_feed import (
    HrEssFeedComment,
    HrEssFeedLike,
    HrEssFeedMedia,
    HrEssFeedPost,
)
from modules.hr.repository.ess_feed_repository import EssFeedRepository

ASPECT_RATIOS = frozenset({"1:1", "3:4", "4:3"})


class EssFeedService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._feed = EssFeedRepository(db)

    def _author_map(self, employee_ids: set[UUID]) -> dict[UUID, tuple[str, str]]:
        out: dict[UUID, tuple[str, str]] = {}
        for eid in employee_ids:
            # Lightweight: load via repository get when available
            row = self._db.get(
                __import__(
                    "modules.master_data.models.employee", fromlist=["MasterEmployee"]
                ).MasterEmployee,
                eid,
            )
            if row is None:
                continue
            name = f"{row.first_name} {row.last_name or ''}".strip()
            out[eid] = (name, row.employee_code)
        return out

    def _to_post_item(
        self,
        post: HrEssFeedPost,
        media: list[HrEssFeedMedia],
        *,
        liked: bool,
        authors: dict[UUID, tuple[str, str]],
    ) -> EssFeedPostItem:
        author_name, author_code = authors.get(post.author_employee_id, ("Employee", ""))
        return EssFeedPostItem(
            id=post.id,
            author_employee_id=post.author_employee_id,
            author_name=author_name,
            author_employee_code=author_code,
            caption=post.caption,
            aspect_ratio=post.aspect_ratio,
            status=post.status,
            like_count=post.like_count,
            comment_count=post.comment_count,
            liked_by_me=liked,
            published_at=post.published_at or post.created_at,
            media=[
                EssFeedMediaItem(
                    id=m.id,
                    media_type=m.media_type,
                    sort_order=m.sort_order,
                    content_type=m.content_type,
                    width=m.width,
                    height=m.height,
                    duration_seconds=m.duration_seconds,
                    processing_status=m.processing_status,
                    url=f"/ess/feed/media/{m.id}/download",
                )
                for m in media
            ],
        )

    def list_feed(
        self,
        ctx: TenantContext,
        *,
        limit: int = 20,
        before: datetime | None = None,
    ) -> list[EssFeedPostItem]:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        posts = self._feed.list_posts(ctx, company_id=emp.company_id, limit=limit, before=before)
        post_ids = [p.id for p in posts]
        media_rows = self._feed.list_media_for_posts(post_ids)
        by_post: dict[UUID, list[HrEssFeedMedia]] = {pid: [] for pid in post_ids}
        for m in media_rows:
            by_post.setdefault(m.post_id, []).append(m)
        liked = self._feed.liked_post_ids(employee_id=emp.id, post_ids=post_ids)
        authors = self._author_map({p.author_employee_id for p in posts})
        return [
            self._to_post_item(
                p,
                by_post.get(p.id, []),
                liked=p.id in liked,
                authors=authors,
            )
            for p in posts
        ]

    def get_post(self, ctx: TenantContext, post_id: UUID) -> EssFeedPostItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        post = self._feed.get_post(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        media = self._feed.list_media_for_posts([post.id])
        liked = post.id in self._feed.liked_post_ids(employee_id=emp.id, post_ids=[post.id])
        authors = self._author_map({post.author_employee_id})
        return self._to_post_item(post, media, liked=liked, authors=authors)

    def create_post(self, ctx: TenantContext, body: EssFeedPostCreate) -> EssFeedPostItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        aspect = (body.aspect_ratio or "1:1").strip()
        if aspect not in ASPECT_RATIOS:
            raise AppException("aspect_ratio must be one of 1:1, 3:4, 4:3")

        media_items = body.media or []
        if not media_items:
            raise AppException("Add at least one photo or video")
        if len(media_items) > MAX_PHOTOS_PER_POST:
            raise AppException(f"Maximum {MAX_PHOTOS_PER_POST} media items per post")

        image_count = sum(1 for m in media_items if m.media_type == "image")
        video_count = sum(1 for m in media_items if m.media_type == "video")
        if video_count > 1:
            raise AppException("Only one video is allowed per post")
        if video_count and image_count:
            raise AppException("Post either photos (up to 10) or a single video, not both")
        if image_count > MAX_PHOTOS_PER_POST:
            raise AppException(f"Maximum {MAX_PHOTOS_PER_POST} photos per post")

        needs_processing = False
        post = HrEssFeedPost(
            tenant_id=ctx.tenant_id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            author_employee_id=emp.id,
            caption=(body.caption or "").strip() or None,
            aspect_ratio=aspect,
            status="published",
            published_at=datetime.now(timezone.utc),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._feed.add_post(post)

        saved_media: list[HrEssFeedMedia] = []
        for index, item in enumerate(media_items):
            raw = self._decode_base64(item.content_base64)
            if item.media_type == "video":
                duration = item.duration_seconds or 0
                if duration > MAX_VIDEO_SECONDS:
                    raise AppException(
                        f"Videos must be {MAX_VIDEO_SECONDS} seconds or shorter"
                    )
                uri, content_type, size = save_feed_media_bytes(
                    company_id=emp.company_id,
                    employee_id=emp.id,
                    file_name=item.file_name or "video.mp4",
                    raw=raw,
                    media_kind="video",
                )
                processing = "pending"
                needs_processing = True
            else:
                uri, content_type, size = save_feed_media_bytes(
                    company_id=emp.company_id,
                    employee_id=emp.id,
                    file_name=item.file_name or "photo.jpg",
                    raw=raw,
                    media_kind="image",
                )
                processing = "ready"

            row = HrEssFeedMedia(
                tenant_id=ctx.tenant_id,
                company_id=emp.company_id,
                branch_id=emp.branch_id,
                post_id=post.id,
                media_type=item.media_type,
                sort_order=index,
                file_name=item.file_name or f"media-{index}",
                content_type=content_type,
                storage_uri=uri,
                byte_size=size,
                width=item.width,
                height=item.height,
                duration_seconds=item.duration_seconds,
                processing_status=processing,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._feed.add_media(row)
            saved_media.append(row)

        if needs_processing:
            post.status = "processing"
            self._db.flush()
            self._enqueue_video_compress([m.id for m in saved_media if m.media_type == "video"])

        authors = self._author_map({emp.id})
        return self._to_post_item(post, saved_media, liked=False, authors=authors)

    def toggle_like(self, ctx: TenantContext, post_id: UUID) -> EssFeedPostItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        post = self._feed.get_post(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")

        existing = self._feed.get_like_any(post_id=post.id, employee_id=emp.id)
        if existing and not existing.is_deleted:
            self._feed.soft_delete_like(existing, deleted_by=ctx.user_id)
            post.like_count = max(0, int(post.like_count) - 1)
            liked = False
        elif existing and existing.is_deleted:
            self._feed.restore_like(existing, updated_by=ctx.user_id)
            post.like_count = int(post.like_count) + 1
            liked = True
        else:
            self._feed.add_like(
                HrEssFeedLike(
                    tenant_id=ctx.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    post_id=post.id,
                    employee_id=emp.id,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )
            post.like_count = int(post.like_count) + 1
            liked = True
        post.updated_by = ctx.user_id
        self._db.flush()
        media = self._feed.list_media_for_posts([post.id])
        authors = self._author_map({post.author_employee_id})
        return self._to_post_item(post, media, liked=liked, authors=authors)

    def list_comments(self, ctx: TenantContext, post_id: UUID) -> list[EssFeedCommentItem]:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        post = self._feed.get_post(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        rows = self._feed.list_comments(post.id)
        authors = self._author_map({r.author_employee_id for r in rows})
        return [
            EssFeedCommentItem(
                id=r.id,
                post_id=r.post_id,
                author_employee_id=r.author_employee_id,
                author_name=authors.get(r.author_employee_id, ("Employee", ""))[0],
                body=r.body,
                is_edited=r.is_edited,
                created_at=r.created_at,
            )
            for r in rows
        ]

    def add_comment(
        self, ctx: TenantContext, post_id: UUID, body: EssFeedCommentCreate
    ) -> EssFeedCommentItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        post = self._feed.get_post(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        text = (body.body or "").strip()
        if not text:
            raise AppException("Comment cannot be empty")
        if len(text) > 2000:
            raise AppException("Comment is too long")

        row = HrEssFeedComment(
            tenant_id=ctx.tenant_id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            post_id=post.id,
            author_employee_id=emp.id,
            body=text,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._feed.add_comment(row)
        post.comment_count = int(post.comment_count) + 1
        post.updated_by = ctx.user_id
        self._db.flush()
        return EssFeedCommentItem(
            id=row.id,
            post_id=row.post_id,
            author_employee_id=row.author_employee_id,
            author_name=f"{emp.first_name} {emp.last_name or ''}".strip(),
            body=row.body,
            is_edited=False,
            created_at=row.created_at,
        )

    def download_media(self, ctx: TenantContext, media_id: UUID):
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        media = self._feed.get_media(ctx, media_id)
        if media is None or media.company_id != emp.company_id:
            raise NotFoundException("Media not found")
        uri = media.processed_storage_uri or media.storage_uri
        return load_feed_media_download(uri, media.file_name)

    @staticmethod
    def _decode_base64(value: str) -> bytes:
        payload = (value or "").strip()
        if "," in payload and payload.lower().startswith("data:"):
            payload = payload.split(",", 1)[1]
        try:
            return base64.b64decode(payload, validate=False)
        except (binascii.Error, ValueError) as exc:
            raise AppException("Invalid media encoding") from exc

    def _enqueue_video_compress(self, media_ids: list[UUID]) -> None:
        if not media_ids:
            return
        try:
            from modules.ess.tasks import compress_feed_video

            for mid in media_ids:
                compress_feed_video.delay(str(mid))
        except Exception:
            # Worker optional in local/dev — media stays pending until task runs.
            pass
