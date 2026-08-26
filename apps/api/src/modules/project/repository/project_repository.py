"""Project PrjProject repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.project.models import PrjProject
from modules.project.repository.base import PrjScopedRepository, utcnow


class ProjectRepository(PrjScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjProject | None:
        stmt = select(PrjProject).where(PrjProject.id == row_id, PrjProject.is_deleted.is_(False))
        stmt = self.apply_prj_filter(stmt, PrjProject, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PrjProject).where(
            PrjProject.company_id == company_id,
            PrjProject.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjProject, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_linked_proc_order_ids(self, ctx: TenantContext, company_id: UUID) -> set[UUID]:
        stmt = select(PrjProject.proc_order_id).where(
            PrjProject.company_id == company_id,
            PrjProject.is_deleted.is_(False),
            PrjProject.proc_order_id.is_not(None),
        )
        stmt = self.apply_prj_filter(stmt, PrjProject, ctx, branch_scoped=True)
        return {row for row in self.db.scalars(stmt).all() if row is not None}

    def get_by_proc_order_id(
        self, ctx: TenantContext, proc_order_id: UUID
    ) -> PrjProject | None:
        stmt = select(PrjProject).where(
            PrjProject.proc_order_id == proc_order_id,
            PrjProject.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjProject, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> PrjProject:
        row = PrjProject(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PrjProject | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
