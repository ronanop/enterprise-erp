"""Procurement repository base utilities."""

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

PROCUREMENT_MODULE_KEY = "procurement"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProcScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_optional_company_filter(stmt, model, company_id: UUID | None):
        if company_id is not None and hasattr(model, "company_id"):
            stmt = stmt.where(model.company_id == company_id)
        return stmt

    @staticmethod
    def apply_proc_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = ProcScopedRepository.apply_tenant_filter(stmt, model, ctx)
        return apply_org_scope_filter(
            stmt,
            model,
            ctx,
            module_key=PROCUREMENT_MODULE_KEY,
            branch_scoped=branch_scoped,
        )

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID | None:
        if company_id is not None:
            ProcScopedRepository.ensure_company_access(
                ctx, company_id, module_key=PROCUREMENT_MODULE_KEY
            )
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
