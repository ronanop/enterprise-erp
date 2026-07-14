"""CRM CrmCampaignMember repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmCampaignMember
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class CampaignMemberRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmCampaignMember | None:
        stmt = select(CrmCampaignMember).where(CrmCampaignMember.id == row_id, CrmCampaignMember.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmCampaignMember, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_members(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmCampaignMember).where(
            CrmCampaignMember.company_id == company_id,
            CrmCampaignMember.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmCampaignMember, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmCampaignMember:
        row = CrmCampaignMember(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmCampaignMember | None:
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
