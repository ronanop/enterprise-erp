"""Sales Account (Company) application service.

Product rule #1: Company first — a Lead can ONLY be created from a Company.
``create_lead`` below is therefore the single supported entry point for
creating a sales-process lead; ``LeadService.create`` (used by the legacy
CRM UI) remains untouched for backward compatibility, but the new
``/crm/companies/{id}/leads`` endpoint is the only route wired to sales-lead
creation.
"""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import CrmEntityType, LeadStatus
from modules.crm.models import CrmCompany
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class CompanyService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CompanyRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_companies(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmCompany:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Company account not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields) -> CrmCompany:
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        code = self._numbers.generate(CrmEntityType.COMPANY, cid, CrmCompany, "account_number")
        fields.setdefault("status", "active")
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, account_number=code, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_company",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmCompany:
        existing = self.get(ctx, row_id)
        if existing.locked:
            raise ConflictException("Company account is locked pending approval")
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Company account not found")
        return row

    def create_lead(self, ctx: TenantContext, company_account_id: UUID, *, branch_id: UUID, **lead_fields):
        """The ONLY supported path to create a sales-process lead (rule #1)."""
        account = self.get(ctx, company_account_id)
        if account.status != "active":
            raise ConflictException("Cannot create a lead for an inactive company account")

        from modules.crm.service.lead_service import LeadService

        # ``lead_fields`` typically comes from a Pydantic ``model_dump()`` so
        # missing values arrive as explicit ``None`` keys — use ``or``
        # fallbacks (not ``setdefault``) so company defaults still apply.
        lead_fields["first_name"] = lead_fields.get("first_name") or account.first_name or account.customer_name
        lead_fields["last_name"] = lead_fields.get("last_name") or account.last_name
        lead_fields["company_name"] = account.customer_name
        lead_fields["email"] = lead_fields.get("email") or account.customer_email
        lead_fields["mobile"] = lead_fields.get("mobile") or account.phone or ""
        lead_fields["industry"] = lead_fields.get("industry") or account.industry
        lead_fields["street"] = lead_fields.get("street") or account.billing_street
        lead_fields["city"] = lead_fields.get("city") or account.billing_city
        lead_fields["state"] = lead_fields.get("state") or account.billing_state
        lead_fields["zip"] = lead_fields.get("zip") or account.billing_code
        lead_fields["country"] = lead_fields.get("country") or account.billing_country
        lead_fields["entity_name"] = lead_fields.get("entity_name") or account.customer_name
        lead_fields["entity_email"] = lead_fields.get("entity_email") or account.customer_email
        lead_fields["entity_contact"] = lead_fields.get("entity_contact") or account.phone
        if not lead_fields.get("entity_address"):
            billing_address = ", ".join(
                str(value)
                for value in (
                    account.billing_street,
                    account.billing_city,
                    account.billing_state,
                    account.billing_code,
                    account.billing_country,
                )
                if value
            )
            lead_fields["entity_address"] = billing_address or None
        lead_fields["assigned_date"] = lead_fields.get("assigned_date") or date.today()
        lead_fields["status"] = LeadStatus.NEW.value
        lead_fields["company_account_id"] = company_account_id
        lead_fields["blueprint_state"] = "open"

        return LeadService(self._db).create(
            ctx,
            branch_id=branch_id,
            company_id=account.company_id,
            **lead_fields,
        )
