"""HR workplace feed repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.workplace_feed import (
    HrWorkplaceFeedComment,
    HrWorkplaceFeedLike,
    HrWorkplaceFeedMedia,
    HrWorkplaceFeedPost,
)
from modules.hr.repository.base import HrScopedRepository, utcnow


class WorkplaceFeedPostRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrWorkplaceFeedPost | None:
        stmt = select(HrWorkplaceFeedPost).where(
            HrWorkplaceFeedPost.id == row_id,
            HrWorkplaceFeedPost.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceFeedPost, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_company(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        limit: int = 30,
        before_id: UUID | None = None,
    ) -> list[HrWorkplaceFeedPost]:
        stmt = select(HrWorkplaceFeedPost).where(
            HrWorkplaceFeedPost.is_deleted.is_(False),
            HrWorkplaceFeedPost.company_id == company_id,
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceFeedPost, ctx, branch_scoped=False)
        if before_id is not None:
            anchor = self.get(ctx, before_id)
            if anchor is not None:
                stmt = stmt.where(
                    (HrWorkplaceFeedPost.created_at < anchor.created_at)
                    | (
                        (HrWorkplaceFeedPost.created_at == anchor.created_at)
                        & (HrWorkplaceFeedPost.id < anchor.id)
                    )
                )
        stmt = stmt.order_by(
            HrWorkplaceFeedPost.created_at.desc(),
            HrWorkplaceFeedPost.id.desc(),
        ).limit(max(1, min(limit, 50)))
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceFeedPost:
        row = HrWorkplaceFeedPost(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_caption(
        self, ctx: TenantContext, row_id: UUID, caption: str
    ) -> HrWorkplaceFeedPost | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        row.caption = caption
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return True


class WorkplaceFeedMediaRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_posts(
        self, ctx: TenantContext, post_ids: list[UUID]
    ) -> dict[UUID, list[HrWorkplaceFeedMedia]]:
        if not post_ids:
            return {}
        stmt = (
            select(HrWorkplaceFeedMedia)
            .where(
                HrWorkplaceFeedMedia.post_id.in_(post_ids),
                HrWorkplaceFeedMedia.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceFeedMedia.post_id.asc(),
                HrWorkplaceFeedMedia.sort_order.asc(),
                HrWorkplaceFeedMedia.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceFeedMedia, ctx, branch_scoped=False
        )
        out: dict[UUID, list[HrWorkplaceFeedMedia]] = {}
        for row in self.db.scalars(stmt).all():
            out.setdefault(row.post_id, []).append(row)
        return out

    def list_for_post(
        self, ctx: TenantContext, post_id: UUID
    ) -> list[HrWorkplaceFeedMedia]:
        return self.list_for_posts(ctx, [post_id]).get(post_id, [])

    def get_by_sort(
        self, ctx: TenantContext, post_id: UUID, sort_order: int
    ) -> HrWorkplaceFeedMedia | None:
        stmt = select(HrWorkplaceFeedMedia).where(
            HrWorkplaceFeedMedia.post_id == post_id,
            HrWorkplaceFeedMedia.sort_order == sort_order,
            HrWorkplaceFeedMedia.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceFeedMedia, ctx, branch_scoped=False
        )
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceFeedMedia:
        row = HrWorkplaceFeedMedia(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class WorkplaceFeedLikeRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_for_employee(
        self, ctx: TenantContext, post_id: UUID, employee_id: UUID
    ) -> HrWorkplaceFeedLike | None:
        stmt = select(HrWorkplaceFeedLike).where(
            HrWorkplaceFeedLike.post_id == post_id,
            HrWorkplaceFeedLike.employee_id == employee_id,
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceFeedLike, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_active_for_posts(
        self, ctx: TenantContext, post_ids: list[UUID], employee_id: UUID
    ) -> set[UUID]:
        if not post_ids:
            return set()
        stmt = select(HrWorkplaceFeedLike.post_id).where(
            HrWorkplaceFeedLike.post_id.in_(post_ids),
            HrWorkplaceFeedLike.employee_id == employee_id,
            HrWorkplaceFeedLike.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceFeedLike, ctx, branch_scoped=False)
        return set(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceFeedLike:
        row = HrWorkplaceFeedLike(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class WorkplaceFeedCommentRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_post(
        self, ctx: TenantContext, post_id: UUID
    ) -> list[HrWorkplaceFeedComment]:
        stmt = (
            select(HrWorkplaceFeedComment)
            .where(
                HrWorkplaceFeedComment.post_id == post_id,
                HrWorkplaceFeedComment.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceFeedComment.created_at.asc(),
                HrWorkplaceFeedComment.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceFeedComment, ctx, branch_scoped=False
        )
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceFeedComment:
        row = HrWorkplaceFeedComment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
