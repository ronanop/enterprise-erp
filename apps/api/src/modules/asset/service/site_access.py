"""IT site Location / Building access — IT domain admin or module admin or RBAC."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.asset.dependencies import get_db
from modules.asset.domain.enums import AssetDomain
from modules.asset.service.domain_membership_service import DomainMembershipService
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.rbac_service import RBACService


def _has_rbac(ctx: TenantContext, db: Session, permission_code: str) -> bool:
    if ctx.user_id is None:
        return False
    return RBACService(db).has_permission(ctx.user_id, ctx.tenant_id, permission_code)


def ensure_site_read(ctx: TenantContext, db: Session, permission_code: str = "asset.site:read") -> None:
    domains = DomainMembershipService(db)
    if domains.can_access_domain(ctx, AssetDomain.IT.value) or domains.is_module_admin(ctx):
        return
    if _has_rbac(ctx, db, permission_code) or _has_rbac(ctx, db, "asset.asset:read"):
        return
    raise ForbiddenException(f"IT access or permission {permission_code} required")


def ensure_site_admin(ctx: TenantContext, db: Session, permission_code: str) -> None:
    domains = DomainMembershipService(db)
    if domains.is_domain_admin(ctx, AssetDomain.IT.value) or domains.is_module_admin(ctx):
        return
    if _has_rbac(ctx, db, permission_code):
        return
    raise ForbiddenException(
        f"IT domain admin or permission {permission_code} required"
    )


def require_site_read(permission_code: str = "asset.site:read") -> Callable:
    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        ensure_site_read(ctx, db, permission_code)
        return ctx

    return _checker


def require_site_admin(permission_code: str) -> Callable:
    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        ensure_site_admin(ctx, db, permission_code)
        return ctx

    return _checker
