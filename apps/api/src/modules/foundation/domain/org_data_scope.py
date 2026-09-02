"""Shared org-scope helpers for tenant-wide module admin readers."""

from uuid import UUID

from sqlalchemy import false

from modules.foundation.domain.value_objects import TenantContext

_TENANT_WIDE_USER_TYPES = frozenset({"super_admin", "tenant_admin"})


def has_tenant_wide_data_access(ctx: TenantContext) -> bool:
    """True when HR/master/recruitment queries should span the whole tenant."""
    return ctx.user_type in _TENANT_WIDE_USER_TYPES or ctx.tenant_wide


def effective_company_ids(ctx: TenantContext) -> list[UUID] | None:
    """Company IDs visible to the user. None means tenant-wide (no company filter)."""
    if has_tenant_wide_data_access(ctx):
        return None
    if ctx.scoped_company_ids:
        return list(ctx.scoped_company_ids)
    if ctx.company_id is not None:
        return [ctx.company_id]
    return []


def apply_company_scope(stmt, model, ctx: TenantContext):
    """Restrict a query to the user's assigned companies when not tenant-wide."""
    ids = effective_company_ids(ctx)
    if ids is None:
        return stmt
    if not ids:
        return stmt.where(false())
    company_col = model.company_id if hasattr(model, "company_id") else model.id
    if len(ids) == 1:
        return stmt.where(company_col == ids[0])
    return stmt.where(company_col.in_(ids))
