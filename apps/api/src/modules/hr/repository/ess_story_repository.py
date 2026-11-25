"""Persistence for ESS Instagram-style Stories."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.ess_story import (
    HrEssStory,
    HrEssStoryLike,
    HrEssStoryMention,
    HrEssStoryView,
)
from modules.master_data.models.employee import MasterEmployee


class EssStoryRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add_story(self, row: HrEssStory) -> HrEssStory:
        self._db.add(row)
        self._db.flush()
        return row

    def get_story(self, ctx: TenantContext, story_id: UUID) -> HrEssStory | None:
        return self._db.scalar(
            select(HrEssStory).where(
                HrEssStory.id == story_id,
                HrEssStory.tenant_id == ctx.tenant_id,
                HrEssStory.is_deleted.is_(False),
            )
        )

    def list_active_for_company(
        self, ctx: TenantContext, *, company_id: UUID
    ) -> list[HrEssStory]:
        now = datetime.now(timezone.utc)
        return list(
            self._db.scalars(
                select(HrEssStory)
                .where(
                    HrEssStory.tenant_id == ctx.tenant_id,
                    HrEssStory.company_id == company_id,
                    HrEssStory.is_deleted.is_(False),
                    HrEssStory.status == "active",
                    HrEssStory.expires_at > now,
                )
                .order_by(HrEssStory.published_at.asc())
            ).all()
        )

    def list_active_for_author(
        self, ctx: TenantContext, *, company_id: UUID, author_employee_id: UUID
    ) -> list[HrEssStory]:
        now = datetime.now(timezone.utc)
        return list(
            self._db.scalars(
                select(HrEssStory)
                .where(
                    HrEssStory.tenant_id == ctx.tenant_id,
                    HrEssStory.company_id == company_id,
                    HrEssStory.author_employee_id == author_employee_id,
                    HrEssStory.is_deleted.is_(False),
                    HrEssStory.status == "active",
                    HrEssStory.expires_at > now,
                )
                .order_by(HrEssStory.published_at.asc())
            ).all()
        )

    def viewed_story_ids(
        self, *, viewer_employee_id: UUID, story_ids: list[UUID]
    ) -> set[UUID]:
        if not story_ids:
            return set()
        rows = self._db.scalars(
            select(HrEssStoryView.story_id).where(
                HrEssStoryView.viewer_employee_id == viewer_employee_id,
                HrEssStoryView.story_id.in_(story_ids),
                HrEssStoryView.is_deleted.is_(False),
            )
        ).all()
        return set(rows)

    def liked_story_ids(
        self, *, employee_id: UUID, story_ids: list[UUID]
    ) -> set[UUID]:
        if not story_ids:
            return set()
        rows = self._db.scalars(
            select(HrEssStoryLike.story_id).where(
                HrEssStoryLike.employee_id == employee_id,
                HrEssStoryLike.story_id.in_(story_ids),
                HrEssStoryLike.is_deleted.is_(False),
            )
        ).all()
        return set(rows)

    def get_view_any(
        self, *, story_id: UUID, viewer_employee_id: UUID
    ) -> HrEssStoryView | None:
        return self._db.scalar(
            select(HrEssStoryView).where(
                HrEssStoryView.story_id == story_id,
                HrEssStoryView.viewer_employee_id == viewer_employee_id,
            )
        )

    def add_view(self, row: HrEssStoryView) -> HrEssStoryView:
        self._db.add(row)
        self._db.flush()
        return row

    def restore_view(self, row: HrEssStoryView, *, updated_by: UUID | None) -> None:
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.viewed_at = datetime.now(timezone.utc)
        row.updated_by = updated_by
        self._db.flush()

    def get_like_any(self, *, story_id: UUID, employee_id: UUID) -> HrEssStoryLike | None:
        return self._db.scalar(
            select(HrEssStoryLike).where(
                HrEssStoryLike.story_id == story_id,
                HrEssStoryLike.employee_id == employee_id,
            )
        )

    def add_like(self, row: HrEssStoryLike) -> HrEssStoryLike:
        self._db.add(row)
        self._db.flush()
        return row

    def soft_delete_like(self, row: HrEssStoryLike, *, deleted_by: UUID | None) -> None:
        now = datetime.now(timezone.utc)
        row.is_deleted = True
        row.deleted_at = now
        row.deleted_by = deleted_by
        row.updated_by = deleted_by
        self._db.flush()

    def restore_like(self, row: HrEssStoryLike, *, updated_by: UUID | None) -> None:
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.updated_by = updated_by
        self._db.flush()

    def add_mention(self, row: HrEssStoryMention) -> HrEssStoryMention:
        self._db.add(row)
        self._db.flush()
        return row

    def list_mentions(self, story_id: UUID) -> list[HrEssStoryMention]:
        return list(
            self._db.scalars(
                select(HrEssStoryMention).where(
                    HrEssStoryMention.story_id == story_id,
                    HrEssStoryMention.is_deleted.is_(False),
                )
            ).all()
        )

    def search_colleagues(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        query: str,
        limit: int = 12,
    ) -> list[MasterEmployee]:
        q = (query or "").strip()
        if len(q) < 1:
            return []
        pattern = f"%{q}%"
        return list(
            self._db.scalars(
                select(MasterEmployee)
                .where(
                    MasterEmployee.tenant_id == ctx.tenant_id,
                    MasterEmployee.company_id == company_id,
                    MasterEmployee.is_deleted.is_(False),
                    or_(
                        MasterEmployee.first_name.ilike(pattern),
                        MasterEmployee.last_name.ilike(pattern),
                        func.concat(
                            MasterEmployee.first_name, " ", MasterEmployee.last_name
                        ).ilike(pattern),
                        MasterEmployee.employee_code.ilike(pattern),
                    ),
                )
                .order_by(MasterEmployee.first_name.asc(), MasterEmployee.last_name.asc())
                .limit(limit)
            ).all()
        )

    def expire_due(self, *, limit: int = 500) -> int:
        now = datetime.now(timezone.utc)
        rows = list(
            self._db.scalars(
                select(HrEssStory)
                .where(
                    HrEssStory.is_deleted.is_(False),
                    HrEssStory.status == "active",
                    HrEssStory.expires_at <= now,
                )
                .limit(limit)
            ).all()
        )
        for row in rows:
            row.status = "expired"
            row.is_deleted = True
            row.deleted_at = now
        if rows:
            self._db.flush()
        return len(rows)
