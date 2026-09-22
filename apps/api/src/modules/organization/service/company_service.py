"""Company service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.notification_service import NotificationService
from modules.organization.repository.company_repository import CompanyRepository
from modules.organization.service.org_scope_validator import OrgScopeValidator


class CompanyService:
    def __init__(self, db: Session) -> None:
        self._repo = CompanyRepository(db)
        self._audit = AuditService(db)
        self._notifications = NotificationService(db)
        self._scope = OrgScopeValidator(db)

    def list_companies(self, ctx: TenantContext):
        return self._repo.list_companies(ctx)

    def get_company(self, ctx: TenantContext, company_id: UUID):
        company = self._repo.get_by_id(ctx, company_id)
        if company is None:
            raise NotFoundException("Company not found")
        self._scope.validate_company_access(ctx, company_id)
        return company

    def create_company(
        self,
        ctx: TenantContext,
        *,
        company_code: str,
        company_name: str,
        legal_name: str,
        country_code: str,
        currency_code: str,
        registration_number: str | None = None,
        tax_number: str | None = None,
        fiscal_year_start_month: int = 4,
        timezone: str = "Asia/Kolkata",
        status: str = "active",
    ):
        if self._repo.get_by_code(ctx, company_code):
            raise ConflictException("Company code already exists")
        company = self._repo.create(
            ctx,
            company_code=company_code,
            company_name=company_name,
            legal_name=legal_name,
            country_code=country_code,
            currency_code=currency_code,
            registration_number=registration_number,
            tax_number=tax_number,
            fiscal_year_start_month=fiscal_year_start_month,
            timezone=timezone,
            status=status or "active",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"company_code": company_code},
        )
        return company

    def update_company(self, ctx: TenantContext, company_id: UUID, **fields):
        self._scope.validate_company_access(ctx, company_id)
        company = self._repo.update(ctx, company_id, **fields)
        if company is None:
            raise NotFoundException("Company not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return company

    def delete_company(self, ctx: TenantContext, company_id: UUID) -> None:
        self._scope.validate_company_access(ctx, company_id)
        if not self._repo.soft_delete(ctx, company_id):
            raise NotFoundException("Company not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_company",
            entity_id=company_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def activate(self, ctx: TenantContext, company_id: UUID):
        return self.update_company(ctx, company_id, status="active")

    def deactivate(self, ctx: TenantContext, company_id: UUID):
        return self.update_company(ctx, company_id, status="inactive")
