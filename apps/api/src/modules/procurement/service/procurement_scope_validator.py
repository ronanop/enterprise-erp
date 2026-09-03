"""Procurement scope validation."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, NotFoundException
from modules.foundation.domain.org_data_scope import (
    effective_company_ids,
    has_module_wide_data_access,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository
from modules.organization.repository.branch_repository import BranchRepository
from modules.organization.repository.company_repository import CompanyRepository

PROCUREMENT_MODULE_KEY = "procurement"


class ProcurementScopeValidator:
    def __init__(self, db: Session) -> None:
        self._company_repo = CompanyRepository(db)
        self._branch_repo = BranchRepository(db)

    def resolve_company_id(self, ctx: TenantContext, company_id: UUID | None) -> UUID | None:
        if company_id is not None:
            self.validate_company_access(ctx, company_id)
            return company_id
        if has_module_wide_data_access(ctx, PROCUREMENT_MODULE_KEY):
            allowed = effective_company_ids(ctx, module_key=PROCUREMENT_MODULE_KEY)
            if allowed is None:
                return ctx.company_id
            if len(allowed) > 1:
                return None
            if len(allowed) == 1:
                return allowed[0]
            return ctx.company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        OrgScopedRepository.ensure_company_access(
            ctx, company_id, module_key=PROCUREMENT_MODULE_KEY
        )
        company = self._company_repo.get_by_id(ctx, company_id)
        if company is None:
            raise NotFoundException("Company not found")

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        OrgScopedRepository.ensure_branch_access(
            ctx, branch_id, module_key=PROCUREMENT_MODULE_KEY
        )
