"""CRM CrmOvf / CrmOvfLine repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmOvf, CrmOvfLine
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class OvfRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmOvf | None:
        stmt = select(CrmOvf).where(CrmOvf.id == row_id, CrmOvf.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmOvf, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_ovfs(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        opportunity_id: UUID | None = None,
    ):
        stmt = select(CrmOvf).where(
            CrmOvf.company_id == company_id,
            CrmOvf.is_deleted.is_(False),
        )
        if opportunity_id is not None:
            stmt = stmt.where(CrmOvf.opportunity_id == opportunity_id)
        stmt = self.apply_crm_filter(stmt, CrmOvf, ctx, branch_scoped=True)
        stmt = stmt.order_by(CrmOvf.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def list_shared_to_scm(self, ctx: TenantContext, company_id: UUID) -> list[CrmOvf]:
        """OVFs Finance/Sales shared to SCM (approved commercial lock)."""
        stmt = select(CrmOvf).where(
            CrmOvf.company_id == company_id,
            CrmOvf.is_deleted.is_(False),
            CrmOvf.shared_to_scm.is_(True),
            CrmOvf.blueprint_state.in_(("shared_scm", "deal_won")),
        )
        stmt = self.apply_crm_filter(stmt, CrmOvf, ctx, branch_scoped=True)
        stmt = stmt.order_by(CrmOvf.updated_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmOvf:
        row = CrmOvf(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmOvf | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class OvfLineRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmOvfLine | None:
        stmt = select(CrmOvfLine).where(CrmOvfLine.id == row_id, CrmOvfLine.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmOvfLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_for_ovf(self, ctx: TenantContext, ovf_id: UUID):
        stmt = select(CrmOvfLine).where(
            CrmOvfLine.ovf_id == ovf_id,
            CrmOvfLine.is_deleted.is_(False),
        ).order_by(CrmOvfLine.side, CrmOvfLine.line_no)
        stmt = self.apply_crm_filter(stmt, CrmOvfLine, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmOvfLine:
        row = CrmOvfLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmOvfLine | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
