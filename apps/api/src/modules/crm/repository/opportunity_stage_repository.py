"""CRM CrmOpportunityStage repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmOpportunityStage
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class OpportunityStageRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmOpportunityStage | None:
        stmt = select(CrmOpportunityStage).where(CrmOpportunityStage.id == row_id, CrmOpportunityStage.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmOpportunityStage, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_stages(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmOpportunityStage).where(
            CrmOpportunityStage.company_id == company_id,
            CrmOpportunityStage.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmOpportunityStage, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_for_opportunity(self, ctx: TenantContext, opportunity_id: UUID):
        stmt = (
            select(CrmOpportunityStage)
            .where(
                CrmOpportunityStage.opportunity_id == opportunity_id,
                CrmOpportunityStage.is_deleted.is_(False),
            )
            .order_by(CrmOpportunityStage.sequence_no, CrmOpportunityStage.entered_at)
        )
        stmt = self.apply_crm_filter(stmt, CrmOpportunityStage, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmOpportunityStage:
        row = CrmOpportunityStage(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmOpportunityStage | None:
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
