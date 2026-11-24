"""Company-wide ESS workplace feed service."""

from __future__ import annotations

import base64
import binascii
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ForbiddenException, NotFoundException
from modules.ess.feed_notify import notify_company_new_post, notify_post_author
from modules.ess.feed_storage import FeedImageDownload, load_feed_image, save_feed_image_bytes
from modules.ess.schemas import (
    EssFeedCommentCreate,
    EssFeedCommentItem,
    EssFeedMediaItem,
    EssFeedPostCreate,
    EssFeedPostItem,
    EssFeedLikeResponse,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.repository.workplace_feed_repository import (
    WorkplaceFeedCommentRepository,
    WorkplaceFeedLikeRepository,
    WorkplaceFeedMediaRepository,
    WorkplaceFeedPostRepository,
)
from modules.hr.repository.base import utcnow
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.employee_repository import EmployeeRepository

MAX_FEED_PHOTOS = 5


def _display_name(first: str, last: str) -> str:
    return f"{(first or '').strip()} {(last or '').strip()}".strip() or "Employee"


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "E"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[1][0]}".upper()


def _decode_image_b64(payload: str) -> bytes:
    data = payload.strip()
    if data.startswith("data:") and "," in data:
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppException("Invalid file content (base64)") from exc
    if not raw:
        raise AppException("Empty file")
    return raw


class EssFeedService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeRepository(db)
        self._posts = WorkplaceFeedPostRepository(db)
        self._media = WorkplaceFeedMediaRepository(db)
        self._likes = WorkplaceFeedLikeRepository(db)
        self._comments = WorkplaceFeedCommentRepository(db)

    def resolve_employee(self, ctx: TenantContext):
        employee = self._employees.get_by_user_id(ctx, ctx.user_id)
        if employee is None:
            raise NotFoundException("No employee profile linked to this user")
        return employee

    def _author_map(self, employee_ids: list[UUID]) -> dict[UUID, tuple[str, str]]:
        if not employee_ids:
            return {}
        rows = self._db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.id.in_(employee_ids),
                MasterEmployee.is_deleted.is_(False),
            )
        ).all()
        out: dict[UUID, tuple[str, str]] = {}
        for row in rows:
            name = _display_name(row.first_name, row.last_name)
            out[row.id] = (name, _initials(name))
        return out

    def _media_items(self, media_rows) -> list[EssFeedMediaItem]:
        return [
            EssFeedMediaItem(
                sort_order=int(m.sort_order),
                content_type=m.image_content_type,
            )
            for m in media_rows
        ]

    def _to_post_item(
        self,
        row,
        *,
        author_name: str,
        author_initials: str,
        liked_by_me: bool,
        media_rows=None,
    ) -> EssFeedPostItem:
        media = list(media_rows or [])
        if not media:
            media_items = [
                EssFeedMediaItem(sort_order=0, content_type=row.image_content_type)
            ]
        else:
            media_items = self._media_items(media)
        return EssFeedPostItem(
            id=row.id,
            author_employee_id=row.author_employee_id,
            author_name=author_name,
            author_initials=author_initials,
            caption=row.caption or "",
            like_count=int(row.like_count or 0),
            comment_count=int(row.comment_count or 0),
            liked_by_me=liked_by_me,
            created_at=row.created_at,
            image_content_type=row.image_content_type,
            image_count=len(media_items),
            images=media_items,
        )

    def list_posts(
        self,
        ctx: TenantContext,
        *,
        limit: int = 30,
        before_id: UUID | None = None,
    ) -> list[EssFeedPostItem]:
        emp = self.resolve_employee(ctx)
        rows = self._posts.list_company(
            ctx, company_id=emp.company_id, limit=limit, before_id=before_id
        )
        authors = self._author_map([r.author_employee_id for r in rows])
        liked = self._likes.list_active_for_posts(ctx, [r.id for r in rows], emp.id)
        media_map = self._media.list_for_posts(ctx, [r.id for r in rows])
        items: list[EssFeedPostItem] = []
        for row in rows:
            name, initials = authors.get(
                row.author_employee_id, ("Employee", "E")
            )
            items.append(
                self._to_post_item(
                    row,
                    author_name=name,
                    author_initials=initials,
                    liked_by_me=row.id in liked,
                    media_rows=media_map.get(row.id, []),
                )
            )
        return items

    def create_post(self, ctx: TenantContext, body: EssFeedPostCreate) -> EssFeedPostItem:
        emp = self.resolve_employee(ctx)
        images = body.resolved_images()
        if not images:
            raise AppException("At least one photo is required")
        if len(images) > MAX_FEED_PHOTOS:
            raise AppException(f"Maximum {MAX_FEED_PHOTOS} photos per post")

        caption = (body.caption or "").strip()
        if len(caption) > 2000:
            raise AppException("Caption too long (max 2000 characters)")

        post_id = uuid4()
        stored: list[tuple[int, str, str, str]] = []
        for idx, image in enumerate(images):
            raw = _decode_image_b64(image.file_base64)
            file_name = (image.file_name or f"photo_{idx + 1}.jpg").strip() or (
                f"photo_{idx + 1}.jpg"
            )
            storage_uri, stored_name, media_type = save_feed_image_bytes(
                company_id=emp.company_id,
                post_id=post_id,
                file_name=file_name,
                raw=raw,
                content_type=image.content_type,
            )
            stored.append((idx, storage_uri, stored_name, media_type))

        cover = stored[0]
        row = self._posts.create(
            ctx,
            id=post_id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            author_employee_id=emp.id,
            caption=caption,
            storage_uri=cover[1],
            image_content_type=cover[3],
            image_file_name=cover[2],
            like_count=0,
            comment_count=0,
        )
        media_rows = []
        for sort_order, storage_uri, stored_name, media_type in stored:
            media_rows.append(
                self._media.create(
                    ctx,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    post_id=row.id,
                    sort_order=sort_order,
                    storage_uri=storage_uri,
                    image_content_type=media_type,
                    image_file_name=stored_name,
                )
            )

        notify_company_new_post(
            self._db,
            ctx=ctx,
            company_id=emp.company_id,
            author_employee_id=emp.id,
            author_first=emp.first_name,
            author_last=emp.last_name,
            post_id=row.id,
            caption=caption,
        )
        name = _display_name(emp.first_name, emp.last_name)
        return self._to_post_item(
            row,
            author_name=name,
            author_initials=_initials(name),
            liked_by_me=False,
            media_rows=media_rows,
        )

    def resolve_image(
        self, ctx: TenantContext, post_id: UUID, *, index: int = 0
    ) -> FeedImageDownload:
        emp = self.resolve_employee(ctx)
        row = self._posts.get(ctx, post_id)
        if row is None or row.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        if index < 0 or index >= MAX_FEED_PHOTOS:
            raise NotFoundException("Photo not found")

        media = self._media.get_by_sort(ctx, post_id, index)
        if media is not None:
            return load_feed_image(media.storage_uri, media.image_file_name)
        if index == 0:
            return load_feed_image(row.storage_uri, row.image_file_name)
        raise NotFoundException("Photo not found")

    def toggle_like(self, ctx: TenantContext, post_id: UUID) -> EssFeedLikeResponse:
        emp = self.resolve_employee(ctx)
        post = self._posts.get(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")

        existing = self._likes.get_for_employee(ctx, post_id, emp.id)
        if existing is None:
            self._likes.create(
                ctx,
                company_id=emp.company_id,
                branch_id=emp.branch_id,
                post_id=post.id,
                employee_id=emp.id,
            )
            post.like_count = int(post.like_count or 0) + 1
            liked = True
        elif existing.is_deleted:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.updated_at = utcnow()
            existing.updated_by = ctx.user_id
            post.like_count = int(post.like_count or 0) + 1
            liked = True
        else:
            existing.is_deleted = True
            existing.deleted_at = utcnow()
            existing.updated_at = utcnow()
            existing.updated_by = ctx.user_id
            post.like_count = max(0, int(post.like_count or 0) - 1)
            liked = False

        post.updated_at = utcnow()
        post.updated_by = ctx.user_id
        self._db.flush()
        if liked:
            notify_post_author(
                self._db,
                ctx=ctx,
                author_employee_id=post.author_employee_id,
                actor_first=emp.first_name,
                actor_last=emp.last_name,
                post_id=post.id,
                kind="like",
            )
        return EssFeedLikeResponse(
            post_id=post.id,
            liked_by_me=liked,
            like_count=int(post.like_count or 0),
        )

    def list_comments(
        self, ctx: TenantContext, post_id: UUID
    ) -> list[EssFeedCommentItem]:
        emp = self.resolve_employee(ctx)
        post = self._posts.get(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        rows = self._comments.list_for_post(ctx, post_id)
        authors = self._author_map([r.author_employee_id for r in rows])
        items: list[EssFeedCommentItem] = []
        for row in rows:
            name, _ = authors.get(row.author_employee_id, ("Employee", "E"))
            items.append(
                EssFeedCommentItem(
                    id=row.id,
                    post_id=row.post_id,
                    author_employee_id=row.author_employee_id,
                    author_name=name,
                    body=row.body,
                    created_at=row.created_at,
                )
            )
        return items

    def add_comment(
        self, ctx: TenantContext, post_id: UUID, body: EssFeedCommentCreate
    ) -> EssFeedCommentItem:
        emp = self.resolve_employee(ctx)
        post = self._posts.get(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        text = (body.body or "").strip()
        if not text:
            raise AppException("Comment cannot be empty")
        if len(text) > 1000:
            raise AppException("Comment too long (max 1000 characters)")

        row = self._comments.create(
            ctx,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            post_id=post.id,
            author_employee_id=emp.id,
            body=text,
        )
        post.comment_count = int(post.comment_count or 0) + 1
        post.updated_at = utcnow()
        post.updated_by = ctx.user_id
        self._db.flush()
        notify_post_author(
            self._db,
            ctx=ctx,
            author_employee_id=post.author_employee_id,
            actor_first=emp.first_name,
            actor_last=emp.last_name,
            post_id=post.id,
            kind="comment",
            comment_preview=text,
        )
        name = _display_name(emp.first_name, emp.last_name)
        return EssFeedCommentItem(
            id=row.id,
            post_id=row.post_id,
            author_employee_id=row.author_employee_id,
            author_name=name,
            body=row.body,
            created_at=row.created_at,
        )

    def update_caption(
        self, ctx: TenantContext, post_id: UUID, caption: str
    ) -> EssFeedPostItem:
        emp = self.resolve_employee(ctx)
        post = self._posts.get(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        if post.author_employee_id != emp.id:
            raise ForbiddenException("Only the author can edit this post")
        text = (caption or "").strip()
        if len(text) > 2000:
            raise AppException("Caption too long (max 2000)")
        updated = self._posts.update_caption(ctx, post_id, text)
        if updated is None:
            raise NotFoundException("Post not found")
        liked = self._likes.get_for_employee(ctx, post_id, emp.id) is not None
        media = self._media.list_for_posts(ctx, [post_id]).get(post_id, [])
        name = _display_name(emp.first_name, emp.last_name)
        return self._to_post_item(
            updated,
            author_name=name,
            author_initials=_initials(name),
            liked_by_me=liked,
            media_rows=media,
        )

    def delete_post(self, ctx: TenantContext, post_id: UUID) -> None:
        emp = self.resolve_employee(ctx)
        post = self._posts.get(ctx, post_id)
        if post is None or post.company_id != emp.company_id:
            raise NotFoundException("Post not found")
        if post.author_employee_id != emp.id:
            raise ForbiddenException("Only the author can delete this post")
        self._posts.soft_delete(ctx, post_id)
