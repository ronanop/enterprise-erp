"""HR Setup → Legal Entities - tenant-wide org_company master (same rows as Assign HR)."""

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.organization.models.company import OrgCompany
from modules.organization.repository.company_repository import CompanyRepository
from modules.organization.service.company_service import CompanyService


def normalize_employee_code_prefix(raw: str | None) -> str | None:
    """Letters/digits only, uppercased, no hyphen/spaces. Empty → None."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", (raw or "").strip().upper())
    return cleaned or None


class HrLegalEntityService:
    """Tenant-level company list - not filtered to the signed-in session company."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CompanyRepository(db)
        self._companies = CompanyService(db)
        self._audit = PlatformAuditFacade(db)

    def list_entities(self, ctx: TenantContext):
        rows = self._db.scalars(
            select(OrgCompany)
            .where(
                OrgCompany.tenant_id == ctx.tenant_id,
                OrgCompany.is_deleted.is_(False),
            )
            .order_by(OrgCompany.company_name)
        ).all()
        return [CompanyRepository._to_entity(row) for row in rows]

    def create(self, ctx: TenantContext, **fields):
        if "employee_code_prefix" in fields:
            fields["employee_code_prefix"] = normalize_employee_code_prefix(
                fields.get("employee_code_prefix")  # type: ignore[arg-type]
            )
        if isinstance(fields.get("company_code"), str):
            fields["company_code"] = fields["company_code"].strip().upper()
        return self._companies.create_company(ctx, **fields)

    def update(self, ctx: TenantContext, company_id: UUID, **fields):
        new_code = fields.get("company_code")
        if isinstance(new_code, str):
            code = new_code.strip().upper()
            if not code:
                fields.pop("company_code", None)
            else:
                fields["company_code"] = code
                existing = self._repo.get_by_code(ctx, code)
                if existing is not None and existing.id != company_id:
                    raise ConflictException("Company code already exists")
        if "employee_code_prefix" in fields:
            fields["employee_code_prefix"] = normalize_employee_code_prefix(
                fields.get("employee_code_prefix")  # type: ignore[arg-type]
            )
        company = self._repo.update(ctx, company_id, **fields)
        if company is None:
            raise NotFoundException("Legal entity not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={k: "[logo]" if k == "logo_url" and v else v for k, v in fields.items()},
        )
        return company

    def delete(self, ctx: TenantContext, company_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, company_id):
            raise NotFoundException("Legal entity not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
