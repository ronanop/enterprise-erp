"""Shared org-scope helpers for tenant-wide module admin readers."""

from uuid import UUID

from sqlalchemy import false

from modules.foundation.domain.value_objects import TenantContext

_TENANT_WIDE_USER_TYPES = frozenset({"super_admin", "tenant_admin"})


def has_tenant_wide_data_access(ctx: TenantContext) -> bool:
    """True when the user may open every company in the tenant."""
    return ctx.user_type in _TENANT_WIDE_USER_TYPES or ctx.tenant_wide


def effective_company_ids(ctx: TenantContext) -> list[UUID] | None:
    """Company IDs the user may access. None means tenant-wide (no company filter)."""
    if has_tenant_wide_data_access(ctx):
        return None
    if ctx.scoped_company_ids:
        return list(ctx.scoped_company_ids)
    if ctx.company_id is not None:
        return [ctx.company_id]
    return []


def data_company_ids(ctx: TenantContext) -> list[UUID] | None:
    """Company IDs for data queries.

    A selected session company narrows lists to that entity when the user may
    use it. Permission checks still use ``effective_company_ids``.
    """
    if ctx.all_companies:
        return effective_company_ids(ctx)
    allowed = effective_company_ids(ctx)
    selected = ctx.company_id
    if selected is None:
        return allowed
    if allowed is None or selected in allowed:
        return [selected]
    return allowed


def apply_company_scope(stmt, model, ctx: TenantContext):
    """Restrict a query to the active entity, or to assigned companies when none is selected."""
    ids = data_company_ids(ctx)
    if ids is None:
        return stmt
    if not ids:
        return stmt.where(false())
    company_col = model.company_id if hasattr(model, "company_id") else model.id
    if len(ids) == 1:
        return stmt.where(company_col == ids[0])
    return stmt.where(company_col.in_(ids))
