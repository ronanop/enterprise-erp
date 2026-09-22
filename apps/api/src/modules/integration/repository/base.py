"""Integration repository base utilities."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.org_data_scope import apply_org_scope_filter
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository

MODULE_KEY = "integration"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IntegrationScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_integration_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = IntegrationScopedRepository.apply_tenant_filter(stmt, model, ctx)
        return apply_org_scope_filter(
            stmt, model, ctx, module_key=MODULE_KEY, branch_scoped=branch_scoped
        )

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            IntegrationScopedRepository.ensure_company_access(ctx, company_id, module_key=MODULE_KEY)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
