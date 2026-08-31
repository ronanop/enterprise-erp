"""HR Setup → Legal Entities — tenant-wide org_company master (same rows as Assign HR)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.organization.models.company import OrgCompany
from modules.organization.repository.company_repository import CompanyRepository
from modules.organization.service.company_service import CompanyService


class HrLegalEntityService:
    """Tenant-level company list — not filtered to the signed-in session company."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CompanyRepository(db)
        self._companies = CompanyService(db)
        self._audit = AuditService(db)

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
        company = self._repo.update(ctx, company_id, **fields)
        if company is None:
            raise NotFoundException("Legal entity not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
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
