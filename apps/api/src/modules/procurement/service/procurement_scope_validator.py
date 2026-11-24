"""Procurement scope validation."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.org_data_scope import (
    resolve_list_company_id as shared_resolve_list_company_id,
    resolve_write_company_id as shared_resolve_write_company_id,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository
from modules.organization.repository.company_repository import CompanyRepository

PROCUREMENT_MODULE_KEY = "procurement"


class ProcurementScopeValidator:
    def __init__(self, db: Session) -> None:
        self._company_repo = CompanyRepository(db)

    def resolve_list_company_id(
        self, ctx: TenantContext, company_id: UUID | None
    ) -> UUID | None:
        """Optional company filter for list/read APIs (never session-pin alone)."""
        if company_id is not None:
            self.validate_company_access(ctx, company_id)
        return shared_resolve_list_company_id(
            ctx, company_id, module_key=PROCUREMENT_MODULE_KEY
        )

    def resolve_company_id(self, ctx: TenantContext, company_id: UUID | None) -> UUID:
        """Concrete company for create/update - always requires a single company."""
        if company_id is not None:
            self.validate_company_access(ctx, company_id)
            return company_id
        return shared_resolve_write_company_id(ctx, None)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        OrgScopedRepository.ensure_company_access(
            ctx, company_id, module_key=PROCUREMENT_MODULE_KEY
        )
        company = self._company_repo.get_by_id(ctx, company_id)
        if company is None:
            raise NotFoundException("Company not found")

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        """Do not isolate by session branch.

        Parking on CDPL HQ used to raise ``Branch scope mismatch`` for CT/VAPL
        POs (Create PO, approval, and Projects PO Queue enrichment). Company
        separation stays on list filters / ``validate_company_access``; branch
        alone must never block cross-entity or cross-module reads.
        """
        _ = (ctx, branch_id)
        return
