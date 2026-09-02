"""CRM KYC record repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models.kyc_record import CrmKycRecord
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class KycRecordRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmKycRecord | None:
        stmt = select(CrmKycRecord).where(
            CrmKycRecord.id == row_id,
            CrmKycRecord.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmKycRecord, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_records(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        company_account_id: UUID | None = None,
    ):
        stmt = select(CrmKycRecord).where(
            CrmKycRecord.company_id == company_id,
            CrmKycRecord.is_deleted.is_(False),
        )
        if company_account_id is not None:
            stmt = stmt.where(CrmKycRecord.company_account_id == company_account_id)
        stmt = self.apply_crm_filter(stmt, CrmKycRecord, ctx, branch_scoped=True)
        stmt = stmt.order_by(CrmKycRecord.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmKycRecord:
        row = CrmKycRecord(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmKycRecord | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
