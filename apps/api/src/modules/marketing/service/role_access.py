"""Marketing team-role authorization helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    MARKETING_ROLE_HEAD,
    MODULE_ROLE_ADMIN,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_module_repository import UserModuleRepository


def marketing_module_role(db: Session, ctx: TenantContext) -> str | None:
    if ctx.user_id is None:
        return None
    roles = UserModuleRepository(db).list_roles_for_user(ctx.tenant_id, ctx.user_id)
    return roles.get("marketing")


def is_marketing_module_admin(db: Session, ctx: TenantContext) -> bool:
    if ctx.user_type in ADMIN_USER_TYPES:
        return True
    if ctx.user_id is None:
        return False
    return UserModuleRepository(db).is_module_admin(ctx.tenant_id, ctx.user_id, "marketing")


def ensure_can_create_campaign(db: Session, ctx: TenantContext) -> None:
    """Campaigns may only be created by Marketing head or Marketing module admin."""
    if is_marketing_module_admin(db, ctx):
        return
    role = marketing_module_role(db, ctx)
    if role == MARKETING_ROLE_HEAD:
        return
    if role == MODULE_ROLE_ADMIN:
        return
    raise ForbiddenException(
        "Only Marketing head or Marketing module admin can create campaigns"
    )


def ensure_can_manage_deliverables(db: Session, ctx: TenantContext) -> None:
    """Campaign deliverables may only be added by Marketing head or module admin."""
    if is_marketing_module_admin(db, ctx):
        return
    role = marketing_module_role(db, ctx)
    if role == MARKETING_ROLE_HEAD:
        return
    if role == MODULE_ROLE_ADMIN:
        return
    raise ForbiddenException(
        "Only Marketing head or Marketing module admin can add campaign deliverables"
    )
