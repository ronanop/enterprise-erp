"""Non-IT access helpers — domain membership OR RBAC (either path is enough)."""

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


def ensure_nonit_member_or_permission(
    ctx: TenantContext,
    db: Session,
    permission_code: str,
) -> None:
    """Allow NON_IT member/admin, module admin, or the given RBAC permission."""
    domains = DomainMembershipService(db)
    if domains.can_access_domain(ctx, AssetDomain.NON_IT.value):
        return
    if _has_rbac(ctx, db, permission_code):
        return
    raise ForbiddenException(
        f"Non-IT domain membership or permission {permission_code} required"
    )


def ensure_nonit_type_admin_or_permission(
    ctx: TenantContext,
    db: Session,
    permission_code: str,
) -> None:
    """Allow NON_IT domain admin, module admin, or the given RBAC permission."""
    domains = DomainMembershipService(db)
    if domains.is_domain_admin(ctx, AssetDomain.NON_IT.value) or domains.is_module_admin(ctx):
        return
    if _has_rbac(ctx, db, permission_code):
        return
    raise ForbiddenException(
        f"Non-IT domain admin or permission {permission_code} required"
    )


def require_nonit_access(permission_code: str) -> Callable:
    """FastAPI dependency: NON_IT membership/module-admin OR RBAC permission."""

    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        ensure_nonit_member_or_permission(ctx, db, permission_code)
        return ctx

    return _checker


def require_nonit_type_admin(permission_code: str) -> Callable:
    """FastAPI dependency: NON_IT domain/module admin OR RBAC permission."""

    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        ensure_nonit_type_admin_or_permission(ctx, db, permission_code)
        return ctx

    return _checker
