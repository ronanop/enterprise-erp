"""Persistence for ESS social feed."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.ess_feed import (
    HrEssFeedComment,
    HrEssFeedLike,
    HrEssFeedMedia,
    HrEssFeedPost,
)


class EssFeedRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add_post(self, row: HrEssFeedPost) -> HrEssFeedPost:
        self._db.add(row)
        self._db.flush()
        return row

    def add_media(self, row: HrEssFeedMedia) -> HrEssFeedMedia:
        self._db.add(row)
        self._db.flush()
        return row

    def get_post(self, ctx: TenantContext, post_id: UUID) -> HrEssFeedPost | None:
        return self._db.scalar(
            select(HrEssFeedPost).where(
                HrEssFeedPost.id == post_id,
                HrEssFeedPost.tenant_id == ctx.tenant_id,
                HrEssFeedPost.is_deleted.is_(False),
            )
        )

    def list_posts(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        limit: int = 20,
        before: datetime | None = None,
    ) -> list[HrEssFeedPost]:
        stmt = (
            select(HrEssFeedPost)
            .where(
                HrEssFeedPost.tenant_id == ctx.tenant_id,
                HrEssFeedPost.company_id == company_id,
                HrEssFeedPost.is_deleted.is_(False),
                HrEssFeedPost.status.in_(("published", "processing")),
            )
            .order_by(HrEssFeedPost.published_at.desc().nullslast(), HrEssFeedPost.created_at.desc())
            .limit(min(max(limit, 1), 50))
        )
        if before is not None:
            stmt = stmt.where(HrEssFeedPost.published_at < before)
        return list(self._db.scalars(stmt).all())

    def list_media_for_posts(self, post_ids: list[UUID]) -> list[HrEssFeedMedia]:
        if not post_ids:
            return []
        return list(
            self._db.scalars(
                select(HrEssFeedMedia)
                .where(
                    HrEssFeedMedia.post_id.in_(post_ids),
                    HrEssFeedMedia.is_deleted.is_(False),
                )
                .order_by(HrEssFeedMedia.sort_order.asc())
            ).all()
        )

    def get_media(self, ctx: TenantContext, media_id: UUID) -> HrEssFeedMedia | None:
        return self._db.scalar(
            select(HrEssFeedMedia).where(
                HrEssFeedMedia.id == media_id,
                HrEssFeedMedia.tenant_id == ctx.tenant_id,
                HrEssFeedMedia.is_deleted.is_(False),
            )
        )

    def liked_post_ids(self, *, employee_id: UUID, post_ids: list[UUID]) -> set[UUID]:
        if not post_ids:
            return set()
        rows = self._db.scalars(
            select(HrEssFeedLike.post_id).where(
                HrEssFeedLike.employee_id == employee_id,
                HrEssFeedLike.post_id.in_(post_ids),
                HrEssFeedLike.is_deleted.is_(False),
            )
        ).all()
        return set(rows)

    def get_like(self, *, post_id: UUID, employee_id: UUID) -> HrEssFeedLike | None:
        return self._db.scalar(
            select(HrEssFeedLike).where(
                HrEssFeedLike.post_id == post_id,
                HrEssFeedLike.employee_id == employee_id,
                HrEssFeedLike.is_deleted.is_(False),
            )
        )

    def get_like_any(self, *, post_id: UUID, employee_id: UUID) -> HrEssFeedLike | None:
        """Active or soft-deleted like (unique constraint spans both)."""
        return self._db.scalar(
            select(HrEssFeedLike).where(
                HrEssFeedLike.post_id == post_id,
                HrEssFeedLike.employee_id == employee_id,
            )
        )

    def add_like(self, row: HrEssFeedLike) -> HrEssFeedLike:
        self._db.add(row)
        self._db.flush()
        return row

    def soft_delete_like(self, row: HrEssFeedLike, *, deleted_by: UUID | None) -> None:
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = deleted_by
        self._db.flush()

    def restore_like(self, row: HrEssFeedLike, *, updated_by: UUID | None) -> None:
        row.is_deleted = False
        row.deleted_at = None
        row.deleted_by = None
        row.updated_by = updated_by
        self._db.flush()

    def list_comments(self, post_id: UUID, *, limit: int = 50) -> list[HrEssFeedComment]:
        return list(
            self._db.scalars(
                select(HrEssFeedComment)
                .where(
                    HrEssFeedComment.post_id == post_id,
                    HrEssFeedComment.is_deleted.is_(False),
                )
                .order_by(HrEssFeedComment.created_at.asc())
                .limit(min(max(limit, 1), 100))
            ).all()
        )

    def add_comment(self, row: HrEssFeedComment) -> HrEssFeedComment:
        self._db.add(row)
        self._db.flush()
        return row

    def get_comment(self, ctx: TenantContext, comment_id: UUID) -> HrEssFeedComment | None:
        return self._db.scalar(
            select(HrEssFeedComment).where(
                HrEssFeedComment.id == comment_id,
                HrEssFeedComment.tenant_id == ctx.tenant_id,
                HrEssFeedComment.is_deleted.is_(False),
            )
        )
