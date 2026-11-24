"""Shared org-scope helpers for platform vs module-admin vs member data visibility.

Rules:
- Platform admin (super_admin / tenant_admin): entire tenant (no company/branch filter).
- Module admin (admin_module_keys): full read/write for that module across the tenant
  (all companies/branches). Entity scopes do not shrink module-admin elevation.
- Module member: scoped_company_ids allowlist (+ session branch when branch_scoped).
- Active session entity (topbar switcher) pins data **only for HRMS modules**
  (hr / payroll / recruitment). CRM, finance, procurement, etc. always use the
  assigned allowlist (or module-admin elevation) — never the parked HR entity.

List vs write company resolution:
- resolve_list_company_id  → None when the user can see multiple/all companies.
  Never pin list APIs to the parked session company alone outside HRMS.
- resolve_write_company_id → always a concrete company for create/update.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import false

from core.exceptions import ForbiddenException
from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    ASSET_MODULE_KEY,
    ASSET_SUBMODULE_KEYS,
)
from modules.foundation.domain.value_objects import TenantContext

# Topbar entity switcher is HR-path only; session company_id must not hide
# other ERP modules' multi-entity data (CDPL must not hide CT on CRM/home).
HRMS_ENTITY_SCOPED_MODULE_KEYS = frozenset({"hr", "payroll", "recruitment"})


def is_platform_admin(ctx: TenantContext) -> bool:
    return ctx.user_type in ADMIN_USER_TYPES


def session_entity_pins_module(module_key: str | None) -> bool:
    """True when the active session company should narrow this module's lists."""
    key = (module_key or "").strip().lower()
    return key in HRMS_ENTITY_SCOPED_MODULE_KEYS


def has_module_wide_data_access(ctx: TenantContext, module_key: str) -> bool:
    """True when list/read/write for this module should span the whole tenant.

    Org-assigned module admins get full module data access (all companies), even if
    they also have SecUserOrgScope rows for other member workflows.
    """
    if is_platform_admin(ctx):
        return True
    key = (module_key or "").strip().lower()
    admin_keys = set(ctx.admin_module_keys or ())
    if key and key in admin_keys:
        return True
    # IT / Non-IT submodule admins get wide access within Assets APIs.
    if key == ASSET_MODULE_KEY and (admin_keys & ASSET_SUBMODULE_KEYS):
        return True
    if key in ASSET_SUBMODULE_KEYS and ASSET_MODULE_KEY in admin_keys:
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
    """Compatibility wrapper - procurement module admin or platform."""
    return has_module_wide_data_access(ctx, "procurement")


def effective_company_ids(
    ctx: TenantContext,
    module_key: str | None = None,
) -> list[UUID] | None:
    """Company IDs visible to the user. None means no company filter (tenant-wide).

    Rules:
    - HRMS (hr/payroll/recruitment): topbar entity switcher always wins.
      A concrete session ``company_id`` pins lists even for platform / module admins.
      ``all_companies`` (All assigned entities) restores elevated / allowlist view.
    - Other ERP modules: ignore session entity; use module-admin elevation or
      the full assigned allowlist (CDPL selection must not hide CT on CRM/home).
    - No allowlist falls back to session company when present (legacy single-entity).
    """
    scoped = list(ctx.scoped_company_ids) if ctx.scoped_company_ids else []

    # HRMS entity switcher — pin before admin elevation so CDPL/CT/VAPL actually filter.
    if (
        session_entity_pins_module(module_key)
        and not ctx.all_companies
        and ctx.company_id is not None
    ):
        elevated = is_platform_admin(ctx) or (
            bool(module_key) and has_module_wide_data_access(ctx, module_key)
        )
        if scoped and ctx.company_id not in scoped and not elevated:
            return []
        return [ctx.company_id]

    if module_key:
        if has_module_wide_data_access(ctx, module_key):
            return None
    elif is_platform_admin(ctx):
        return None

    if ctx.all_companies:
        return scoped

    if scoped:
        return scoped
    if ctx.company_id is not None:
        return [ctx.company_id]
    return []


def resolve_list_company_id(
    ctx: TenantContext,
    company_id: UUID | None,
    *,
    module_key: str,
) -> UUID | None:
    """Optional company filter for list/read APIs.

    Returns None when the caller should see every company they can access for
    this module (platform admin, module-wide admin, or multi-entity org scope).
    Do not pin lists to the parked session company alone.
    """
    if company_id is not None:
        return company_id
    if has_module_wide_data_access(ctx, module_key):
        return None
    ids = effective_company_ids(ctx, module_key=module_key)
    if ids is None:
        return None
    if len(ids) == 0:
        return ctx.company_id
    if len(ids) == 1:
        return ids[0]
    return None


def resolve_write_company_id(
    ctx: TenantContext,
    company_id: UUID | None,
) -> UUID:
    """Concrete company for create/update - always requires a single company."""
    if company_id is not None:
        return company_id
    if ctx.company_id is None:
        raise ForbiddenException("Company context required")
    return ctx.company_id


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
    """Session branch must never filter ERP lists.

    Cross-entity users (CDPL + CT + VAPL) hit empty screens / ``Branch scope
    mismatch`` when lists were pinned to the parked HQ branch. HRMS entity
    separation is company-level via ``apply_company_scope`` only.
    """
    _ = (model, ctx, module_key, branch_scoped)
    return stmt


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
