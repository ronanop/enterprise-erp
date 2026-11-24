"""Assets module admin - ERP admins (DB user_type), org-assigned module admins, or asset RBAC admin."""

from __future__ import annotations

from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    ASSET_IT_MODULE_KEY,
    ASSET_MODULE_KEY as ASSET_MODULE_KEY,
    ASSET_NON_IT_MODULE_KEY,
    ASSET_SUBMODULE_KEYS,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.service.rbac_service import RBACService

ASSET_MANAGER_ROLE_CODE = "ASSET_MANAGER"


class AssetModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)
        self._rbac = RBACService(db)

    def is_admin(self, ctx: TenantContext) -> bool:
        """True for full Assets admins (parent key or both IT + Non-IT admin grants)."""
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        admin_keys = set(ctx.admin_module_keys or ())
        # Parent assets admin only counts when not narrowed to a single submodule.
        has_it = (
            ASSET_IT_MODULE_KEY in admin_keys
            or self._modules.get_assignment(
                ctx.tenant_id, ctx.user_id, ASSET_IT_MODULE_KEY
            )
            is not None
        )
        has_non_it = (
            ASSET_NON_IT_MODULE_KEY in admin_keys
            or self._modules.get_assignment(
                ctx.tenant_id, ctx.user_id, ASSET_NON_IT_MODULE_KEY
            )
            is not None
        )
        # Explicit single-submodule assignment → never full module admin.
        if has_it ^ has_non_it:
            return False
        if ASSET_MODULE_KEY in admin_keys and not (has_it or has_non_it):
            return True
        if ASSET_SUBMODULE_KEYS.issubset(admin_keys):
            return True
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, ASSET_MODULE_KEY):
            if has_it or has_non_it:
                return has_it and has_non_it
            return True
        it_admin = self._modules.is_module_admin(
            ctx.tenant_id, ctx.user_id, ASSET_IT_MODULE_KEY
        )
        non_it_admin = self._modules.is_module_admin(
            ctx.tenant_id, ctx.user_id, ASSET_NON_IT_MODULE_KEY
        )
        if it_admin and non_it_admin:
            return True
        # Stale RBAC must not elevate a submodule-scoped user to both domains.
        if has_it or has_non_it:
            return False
        return self._rbac.has_permission(ctx.user_id, ctx.tenant_id, "asset.module:admin")

    def ensure_admin(self, ctx: TenantContext) -> None:
        from core.exceptions import ForbiddenException

        if not self.is_admin(ctx):
            raise ForbiddenException("Assets module admin access required")
