"""Master Data repository base utilities."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.org_data_scope import (
    apply_org_scope_filter,
    effective_company_ids,
    has_module_wide_data_access,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository

MASTER_DATA_MODULE_KEY = "master-data"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MasterScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_master_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = MasterScopedRepository.apply_tenant_filter(stmt, model, ctx)
        return apply_org_scope_filter(
            stmt,
            model,
            ctx,
            module_key=MASTER_DATA_MODULE_KEY,
            branch_scoped=branch_scoped,
        )

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID | None:
        if company_id is not None:
            MasterScopedRepository.ensure_company_access(
                ctx, company_id, module_key=MASTER_DATA_MODULE_KEY
            )
            return company_id
        if has_module_wide_data_access(ctx, MASTER_DATA_MODULE_KEY):
            return None
        allowed = effective_company_ids(ctx, module_key=MASTER_DATA_MODULE_KEY)
        if allowed and len(allowed) > 1:
            return None
        if allowed and len(allowed) == 1:
            return allowed[0]
        if ctx.company_id is not None:
            return ctx.company_id
        raise ForbiddenException("Company context required")
