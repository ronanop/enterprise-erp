"""CRM Contact application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.contact_repository import ContactRepository
from modules.crm.service.company_service import CompanyService
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class ContactService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ContactRepository(db)
        self._companies = CompanyService(db)
        self._scope = CrmScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None, company_account_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_contacts(ctx, cid, company_account_id)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Contact not found")
        return row

    def create(self, ctx: TenantContext, *, company_account_id: UUID, branch_id: UUID, **fields):
        account = self._companies.get(ctx, company_account_id)
        fields.setdefault("status", "active")
        return self._repo.create(
            ctx,
            company_id=account.company_id,
            branch_id=branch_id,
            company_account_id=company_account_id,
            **fields,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Contact not found")
        return row
