"""CRM KYC record service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models.kyc_record import CrmKycRecord
from modules.crm.repository.kyc_record_repository import KycRecordRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext


class KycRecordService:
    def __init__(self, db: Session) -> None:
        self._repo = KycRecordRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        company_account_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_records(ctx, cid, company_account_id=company_account_id)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmKycRecord:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("KYC record not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.KYC, cid, CrmKycRecord, "kyc_code")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, kyc_code=code, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        updated = self._repo.update(ctx, row.id, **fields)
        if updated is None:
            raise NotFoundException("KYC record not found")
        return updated
