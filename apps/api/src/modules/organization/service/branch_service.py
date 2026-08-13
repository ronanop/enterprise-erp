"""Branch service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.organization.repository.branch_repository import BranchRepository
from modules.organization.repository.company_repository import CompanyRepository
from modules.organization.service.org_scope_validator import OrgScopeValidator


class BranchService:
    def __init__(self, db: Session) -> None:
        self._repo = BranchRepository(db)
        self._companies = CompanyRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    def list_branches(self, ctx: TenantContext, *, company_id: UUID | None = None):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        return self._repo.list_branches(ctx, company_id=company_id)

    def get_branch(self, ctx: TenantContext, branch_id: UUID):
        branch = self._repo.get_by_id(ctx, branch_id)
        if branch is None:
            raise NotFoundException("Branch not found")
        self._scope.validate_branch_access(ctx, branch_id)
        return branch

    def create_branch(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_code: str,
        branch_name: str,
        branch_type: str = "regional",
        address_line1: str | None = None,
        city: str | None = None,
        state_code: str | None = None,
        country_code: str | None = None,
        head_employee_id: UUID | None = None,
    ):
        if self._companies.get_by_id(ctx, company_id) is None:
            raise NotFoundException("Company not found")
        self._scope.validate_company_access(ctx, company_id)
        branch = self._repo.create(
            ctx,
            company_id=company_id,
            branch_code=branch_code,
            branch_name=branch_name,
            branch_type=branch_type,
            address_line1=address_line1,
            city=city,
            state_code=state_code,
            country_code=country_code,
            head_employee_id=head_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_branch",
            entity_id=branch.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"branch_code": branch_code, "company_id": str(company_id)},
        )
        return branch

    def update_branch(self, ctx: TenantContext, branch_id: UUID, **fields):
        self._scope.validate_branch_access(ctx, branch_id)
        branch = self._repo.update(ctx, branch_id, **fields)
        if branch is None:
            raise NotFoundException("Branch not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_branch",
            entity_id=branch_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return branch

    def delete_branch(self, ctx: TenantContext, branch_id: UUID) -> None:
        self._scope.validate_branch_access(ctx, branch_id)
        if not self._repo.soft_delete(ctx, branch_id):
            raise NotFoundException("Branch not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_branch",
            entity_id=branch_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
