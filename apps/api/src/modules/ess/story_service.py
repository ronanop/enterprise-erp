"""ESS Instagram-style Stories — tray, create, view, like, mentions, media."""

from __future__ import annotations

import base64
import binascii
from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.ess.schemas import (
    EssStoryCreate,
    EssStoryItem,
    EssStoryMentionItem,
    EssStoryMentionSearchHit,
    EssStoryOverlay,
    EssStoryTrayAuthor,
)
from modules.ess.story_storage import (
    MAX_VIDEO_SECONDS,
    load_story_media_download,
    save_story_media_bytes,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.ess_story import (
    HrEssStory,
    HrEssStoryLike,
    HrEssStoryMention,
    HrEssStoryView,
)
from modules.hr.repository.ess_story_repository import EssStoryRepository

STORY_TTL = timedelta(hours=24)


class EssStoryService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._stories = EssStoryRepository(db)

    def _author_map(self, employee_ids: set[UUID]) -> dict[UUID, tuple[str, str]]:
        out: dict[UUID, tuple[str, str]] = {}
        MasterEmployee = __import__(
            "modules.master_data.models.employee", fromlist=["MasterEmployee"]
        ).MasterEmployee
        for eid in employee_ids:
            row = self._db.get(MasterEmployee, eid)
            if row is None:
                continue
            name = f"{row.first_name} {row.last_name or ''}".strip()
            out[eid] = (name, row.employee_code)
        return out

    def _overlays(self, story: HrEssStory) -> list[EssStoryOverlay]:
        raw = story.overlays_json or []
        out: list[EssStoryOverlay] = []
        for item in raw:
            try:
                out.append(EssStoryOverlay.model_validate(item))
            except Exception:
                continue
        return out

    def _mentions(self, story_id: UUID) -> list[EssStoryMentionItem]:
        rows = self._stories.list_mentions(story_id)
        if not rows:
            return []
        MasterEmployee = __import__(
            "modules.master_data.models.employee", fromlist=["MasterEmployee"]
        ).MasterEmployee
        out: list[EssStoryMentionItem] = []
        for m in rows:
            emp = self._db.get(MasterEmployee, m.mentioned_employee_id)
            email = str(emp.email) if emp is not None else None
            out.append(
                EssStoryMentionItem(
                    employee_id=m.mentioned_employee_id,
                    display_name=m.display_name,
                    email=email,
                )
            )
        return out

    def _to_item(
        self,
        story: HrEssStory,
        *,
        authors: dict[UUID, tuple[str, str]],
        viewed: bool,
        liked: bool,
    ) -> EssStoryItem:
        author_name, author_code = authors.get(story.author_employee_id, ("Employee", ""))
        return EssStoryItem(
            id=story.id,
            author_employee_id=story.author_employee_id,
            author_name=author_name,
            author_employee_code=author_code,
            media_type=story.media_type,
            content_type=story.content_type,
            caption=story.caption,
            overlays=self._overlays(story),
            mentions=self._mentions(story.id),
            width=story.width,
            height=story.height,
            duration_seconds=story.duration_seconds,
            published_at=story.published_at,
            expires_at=story.expires_at,
            viewed_by_me=viewed,
            liked_by_me=liked,
            like_count=int(story.like_count or 0),
            url=f"/ess/stories/{story.id}/media/download",
        )

    def tray(self, ctx: TenantContext) -> list[EssStoryTrayAuthor]:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        stories = self._stories.list_active_for_company(ctx, company_id=emp.company_id)
        if not stories:
            return []

        by_author: dict[UUID, list[HrEssStory]] = {}
        for s in stories:
            by_author.setdefault(s.author_employee_id, []).append(s)

        viewed = self._stories.viewed_story_ids(
            viewer_employee_id=emp.id,
            story_ids=[s.id for s in stories],
        )
        authors = self._author_map(set(by_author.keys()))

        trays: list[EssStoryTrayAuthor] = []
        for author_id, items in by_author.items():
            name, code = authors.get(author_id, ("Employee", ""))
            unseen = any(s.id not in viewed for s in items)
            trays.append(
                EssStoryTrayAuthor(
                    author_employee_id=author_id,
                    author_name=name,
                    author_employee_code=code,
                    is_me=author_id == emp.id,
                    has_unseen=unseen,
                    story_count=len(items),
                    latest_published_at=max(s.published_at for s in items),
                )
            )

        def sort_key(row: EssStoryTrayAuthor) -> tuple:
            return (
                0 if row.is_me else 1,
                0 if row.has_unseen else 1,
                -(row.latest_published_at.timestamp() if row.latest_published_at else 0),
            )

        trays.sort(key=sort_key)
        return trays

    def list_for_author(
        self, ctx: TenantContext, author_employee_id: UUID
    ) -> list[EssStoryItem]:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        stories = self._stories.list_active_for_author(
            ctx, company_id=emp.company_id, author_employee_id=author_employee_id
        )
        story_ids = [s.id for s in stories]
        viewed = self._stories.viewed_story_ids(
            viewer_employee_id=emp.id, story_ids=story_ids
        )
        liked = self._stories.liked_story_ids(employee_id=emp.id, story_ids=story_ids)
        authors = self._author_map({author_employee_id})
        return [
            self._to_item(
                s,
                authors=authors,
                viewed=s.id in viewed,
                liked=s.id in liked,
            )
            for s in stories
        ]

    def search_mentions(
        self, ctx: TenantContext, *, query: str
    ) -> list[EssStoryMentionSearchHit]:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        rows = self._stories.search_colleagues(
            ctx, company_id=emp.company_id, query=query, limit=12
        )
        names = [
            f"{r.first_name} {r.last_name or ''}".strip().casefold() for r in rows
        ]
        dup_counts = Counter(names)
        hits: list[EssStoryMentionSearchHit] = []
        for r in rows:
            if r.id == emp.id:
                continue
            display = f"{r.first_name} {r.last_name or ''}".strip()
            hits.append(
                EssStoryMentionSearchHit(
                    employee_id=r.id,
                    display_name=display,
                    email=str(r.email or ""),
                    employee_code=r.employee_code,
                    name_is_duplicate=dup_counts[display.casefold()] > 1,
                )
            )
        return hits

    def create(self, ctx: TenantContext, body: EssStoryCreate) -> EssStoryItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        raw = self._decode_base64(body.content_base64)
        if body.media_type == "video":
            duration = body.duration_seconds or 0
            if duration > MAX_VIDEO_SECONDS:
                raise AppException(
                    f"Story videos must be {MAX_VIDEO_SECONDS} seconds or shorter"
                )
            uri, content_type, size = save_story_media_bytes(
                company_id=emp.company_id,
                employee_id=emp.id,
                file_name=body.file_name or "story.mp4",
                raw=raw,
                media_kind="video",
            )
        else:
            uri, content_type, size = save_story_media_bytes(
                company_id=emp.company_id,
                employee_id=emp.id,
                file_name=body.file_name or "story.jpg",
                raw=raw,
                media_kind="image",
            )

        now = datetime.now(timezone.utc)
        overlays_payload = [o.model_dump() for o in (body.overlays or [])]
        story = HrEssStory(
            tenant_id=ctx.tenant_id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            author_employee_id=emp.id,
            media_type=body.media_type,
            file_name=body.file_name or "story",
            content_type=content_type,
            storage_uri=uri,
            caption=(body.caption or "").strip() or None,
            overlays_json=overlays_payload or None,
            byte_size=size,
            width=body.width,
            height=body.height,
            duration_seconds=body.duration_seconds,
            like_count=0,
            status="active",
            published_at=now,
            expires_at=now + STORY_TTL,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._stories.add_story(story)

        mention_ids: set[UUID] = set()
        for m in body.mentions or []:
            if m.employee_id == emp.id or m.employee_id in mention_ids:
                continue
            mention_ids.add(m.employee_id)
            display = (m.display_name or "").strip() or "Colleague"
            self._stories.add_mention(
                HrEssStoryMention(
                    tenant_id=ctx.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    story_id=story.id,
                    mentioned_employee_id=m.employee_id,
                    display_name=display[:200],
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )
            self._notify_mention(
                ctx,
                author_name=f"{emp.first_name} {emp.last_name or ''}".strip(),
                story_id=story.id,
                mentioned_employee_id=m.employee_id,
            )

        authors = self._author_map({emp.id})
        return self._to_item(story, authors=authors, viewed=False, liked=False)

    def toggle_like(self, ctx: TenantContext, story_id: UUID) -> EssStoryItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        story = self._stories.get_story(ctx, story_id)
        if story is None or story.company_id != emp.company_id:
            raise NotFoundException("Story not found")
        now = datetime.now(timezone.utc)
        if story.status != "active" or story.expires_at <= now:
            raise NotFoundException("Story has expired")

        existing = self._stories.get_like_any(story_id=story.id, employee_id=emp.id)
        if existing and not existing.is_deleted:
            self._stories.soft_delete_like(existing, deleted_by=ctx.user_id)
            story.like_count = max(0, int(story.like_count) - 1)
            liked = False
        elif existing and existing.is_deleted:
            self._stories.restore_like(existing, updated_by=ctx.user_id)
            story.like_count = int(story.like_count) + 1
            liked = True
        else:
            self._stories.add_like(
                HrEssStoryLike(
                    tenant_id=ctx.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    story_id=story.id,
                    employee_id=emp.id,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )
            story.like_count = int(story.like_count) + 1
            liked = True
        story.updated_by = ctx.user_id
        self._db.flush()

        authors = self._author_map({story.author_employee_id})
        viewed = story.id in self._stories.viewed_story_ids(
            viewer_employee_id=emp.id, story_ids=[story.id]
        )
        return self._to_item(story, authors=authors, viewed=viewed, liked=liked)

    def mark_viewed(self, ctx: TenantContext, story_id: UUID) -> EssStoryItem:
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        story = self._stories.get_story(ctx, story_id)
        if story is None or story.company_id != emp.company_id:
            raise NotFoundException("Story not found")
        now = datetime.now(timezone.utc)
        if story.status != "active" or story.expires_at <= now:
            raise NotFoundException("Story has expired")

        existing = self._stories.get_view_any(
            story_id=story.id, viewer_employee_id=emp.id
        )
        if existing and not existing.is_deleted:
            pass
        elif existing and existing.is_deleted:
            self._stories.restore_view(existing, updated_by=ctx.user_id)
        else:
            self._stories.add_view(
                HrEssStoryView(
                    tenant_id=ctx.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    story_id=story.id,
                    viewer_employee_id=emp.id,
                    viewed_at=now,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )

        liked = story.id in self._stories.liked_story_ids(
            employee_id=emp.id, story_ids=[story.id]
        )
        authors = self._author_map({story.author_employee_id})
        return self._to_item(story, authors=authors, viewed=True, liked=liked)

    def download_media(self, ctx: TenantContext, story_id: UUID):
        from modules.ess.service import EssService

        emp = EssService(self._db).resolve_employee(ctx)
        story = self._stories.get_story(ctx, story_id)
        if story is None or story.company_id != emp.company_id:
            raise NotFoundException("Story not found")
        now = datetime.now(timezone.utc)
        if story.status != "active" or story.expires_at <= now:
            raise NotFoundException("Story has expired")
        return load_story_media_download(story.storage_uri, story.file_name)

    def _notify_mention(
        self,
        ctx: TenantContext,
        *,
        author_name: str,
        story_id: UUID,
        mentioned_employee_id: UUID,
    ) -> None:
        from modules.foundation.service.notification_service import NotificationService
        from modules.master_data.models.employee import MasterEmployee

        target = self._db.get(MasterEmployee, mentioned_employee_id)
        if target is None or target.user_id is None:
            return
        if target.company_id != ctx.company_id and target.tenant_id != ctx.tenant_id:
            return

        notif = NotificationService(self._db)
        tpl = notif.get_or_create_template(
            tenant_id=ctx.tenant_id,
            template_code="ess.story_mention",
            template_name="Story mention",
            channel="in_app",
            subject_template="{{title}}",
            body_template="{{body}}",
            created_by=ctx.user_id,
        )
        notif.send(
            tenant_id=ctx.tenant_id,
            template_id=tpl.id,
            event_type="ess.story.mention",
            recipient_user_id=target.user_id,
            recipient_address=None,
            payload_json={
                "title": f"{author_name} mentioned you in a story",
                "body": "Open Stories on Feed to view it before it expires.",
                "kind": "ess_story_mention",
                "entity_type": "hr_ess_story",
                "entity_id": str(story_id),
                "href": "/feed",
            },
            created_by=ctx.user_id,
        )

    @staticmethod
    def _decode_base64(value: str) -> bytes:
        payload = (value or "").strip()
        if "," in payload and payload.lower().startswith("data:"):
            payload = payload.split(",", 1)[1]
        try:
            return base64.b64decode(payload, validate=False)
        except (binascii.Error, ValueError) as exc:
            raise AppException("Invalid media encoding") from exc
