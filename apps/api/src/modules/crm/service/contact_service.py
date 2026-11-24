"""CRM Contact application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        return self._repo.list_contacts(ctx, cid, company_account_id)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Contact not found")
        return row

    def create(self, ctx: TenantContext, *, company_account_id: UUID, branch_id: UUID, **fields):
        account = self._companies.get(ctx, company_account_id)
        fields.setdefault("status", "active")
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "contact", fields.get("custom_fields")
            )
        self._assert_no_duplicate(
            ctx,
            company_account_id=company_account_id,
            email=fields.get("email"),
            phone=fields.get("phone"),
            mobile=fields.get("mobile"),
            first_name=fields.get("first_name"),
            last_name=fields.get("last_name"),
        )
        return self._repo.create(
            ctx,
            company_id=account.company_id,
            branch_id=branch_id,
            company_account_id=company_account_id,
            **fields,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        existing = self.get(ctx, row_id)
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "contact", fields.get("custom_fields")
            )
        merged = {
            "email": fields.get("email", existing.email),
            "phone": fields.get("phone", existing.phone),
            "mobile": fields.get("mobile", existing.mobile),
            "first_name": fields.get("first_name", existing.first_name),
            "last_name": fields.get("last_name", existing.last_name),
        }
        self._assert_no_duplicate(
            ctx,
            company_account_id=existing.company_account_id,
            exclude_id=row_id,
            **merged,
        )
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Contact not found")
        return row

    def _assert_no_duplicate(
        self,
        ctx: TenantContext,
        *,
        company_account_id: UUID,
        email: str | None = None,
        phone: str | None = None,
        mobile: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        exclude_id: UUID | None = None,
    ) -> None:
        hits = self._repo.find_duplicates(
            ctx,
            company_account_id=company_account_id,
            email=email,
            phone=phone,
            mobile=mobile,
            first_name=first_name,
            last_name=last_name,
            exclude_id=exclude_id,
        )
        if not hits:
            return
        hit = hits[0]
        label = " ".join(
            p for p in [(hit.first_name or "").strip(), (hit.last_name or "").strip()] if p
        ) or str(hit.id)
        raise ConflictException(
            f"A similar contact already exists for this account ({label}). "
            "Update the existing contact or merge duplicates instead of creating another."
        )
