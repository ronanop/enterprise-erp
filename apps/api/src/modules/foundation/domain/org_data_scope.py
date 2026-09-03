"""Shared org-scope helpers for platform vs module-admin vs member data visibility.

Rules:
- Platform admin (super_admin / tenant_admin): entire tenant (no company/branch filter).
- Org-assigned module admin: same as platform for that module only.
- Module member: scoped_company_ids / session company (+ session branch when branch_scoped).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false

from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext


def is_platform_admin(ctx: TenantContext) -> bool:
    return ctx.user_type in ADMIN_USER_TYPES


def has_module_wide_data_access(ctx: TenantContext, module_key: str) -> bool:
    """True when list/read queries for this module should span the whole tenant."""
    if is_platform_admin(ctx):
        return True
    key = (module_key or "").strip().lower()
    if key and key in ctx.admin_module_keys:
        return True
    # Legacy flags (migration / older tests).
    if key == "procurement" and ctx.procurement_tenant_wide:
        return True
    if key == "hr" and ctx.tenant_wide:
        return True
    return False


def has_tenant_wide_data_access(ctx: TenantContext, module_key: str | None = None) -> bool:
    """Platform-wide, or module-admin elevation when module_key is provided.

    Without module_key, only platform admins are elevated (HR admin no longer
    bleeds into other modules via a shared tenant_wide flag).
    """
    if is_platform_admin(ctx):
        return True
    if module_key:
        return has_module_wide_data_access(ctx, module_key)
    return False


def has_procurement_tenant_wide_data_access(ctx: TenantContext) -> bool:
    """Compatibility wrapper — procurement module admin or platform."""
    return has_module_wide_data_access(ctx, "procurement")


def effective_company_ids(
    ctx: TenantContext,
    module_key: str | None = None,
) -> list[UUID] | None:
    """Company IDs visible to the user. None means no company filter (tenant-wide)."""
    if module_key:
        if has_module_wide_data_access(ctx, module_key):
            return None
    elif is_platform_admin(ctx):
        return None

    if ctx.scoped_company_ids:
        return list(ctx.scoped_company_ids)
    if ctx.company_id is not None:
        return [ctx.company_id]
    return []


def apply_company_scope(stmt, model, ctx: TenantContext, *, module_key: str | None = None):
    """Restrict a query to the user's companies unless module/platform elevated."""
    ids = effective_company_ids(ctx, module_key=module_key)
    if ids is None:
        return stmt
    if not ids:
        return stmt.where(false())
    company_col = model.company_id if hasattr(model, "company_id") else model.id
    if len(ids) == 1:
        return stmt.where(company_col == ids[0])
    return stmt.where(company_col.in_(ids))


def apply_branch_scope(
    stmt,
    model,
    ctx: TenantContext,
    *,
    module_key: str,
    branch_scoped: bool = False,
):
    """Apply session branch filter for members; skip for platform/module admins."""
    if not branch_scoped or not ctx.branch_id or not hasattr(model, "branch_id"):
        return stmt
    if has_module_wide_data_access(ctx, module_key):
        return stmt
    return stmt.where(model.branch_id == ctx.branch_id)


def apply_org_scope_filter(
    stmt,
    model,
    ctx: TenantContext,
    *,
    module_key: str,
    branch_scoped: bool = False,
):
    """Company + optional branch scope for a module list query (tenant filter separate)."""
    if hasattr(model, "company_id"):
        stmt = apply_company_scope(stmt, model, ctx, module_key=module_key)
    stmt = apply_branch_scope(
        stmt, model, ctx, module_key=module_key, branch_scoped=branch_scoped
    )
    return stmt
