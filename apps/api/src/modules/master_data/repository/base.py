"""Master Data repository base utilities."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.org_data_scope import (
    apply_company_scope,
    effective_company_ids,
    has_tenant_wide_data_access,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MasterScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_master_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = MasterScopedRepository.apply_tenant_filter(stmt, model, ctx)
        if hasattr(model, "company_id"):
            stmt = apply_company_scope(stmt, model, ctx)
        if branch_scoped and ctx.branch_id and not has_tenant_wide_data_access(ctx):
            stmt = stmt.where(model.branch_id == ctx.branch_id)
        return stmt

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID | None:
        if company_id is not None:
            MasterScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if has_tenant_wide_data_access(ctx):
            return None
        allowed = effective_company_ids(ctx)
        if allowed and len(allowed) > 1:
            return None
        if allowed and len(allowed) == 1:
            return allowed[0]
        if ctx.company_id is not None:
            return ctx.company_id
        raise ForbiddenException("Company context required")
