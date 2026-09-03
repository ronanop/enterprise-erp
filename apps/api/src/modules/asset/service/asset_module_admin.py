"""Assets module admin — ERP admins, org-assigned module admins, or asset RBAC admin."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.service.rbac_service import RBACService

ASSET_MODULE_KEY = "assets"
ASSET_MANAGER_ROLE_CODE = "ASSET_MANAGER"


class AssetModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)
        self._rbac = RBACService(db)

    @staticmethod
    def is_platform_admin_email(email: str | None) -> bool:
        if not email:
            return False
        return email.strip().lower() in settings.microsoft_platform_admin_email_set()

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if ASSET_MODULE_KEY in ctx.admin_module_keys:
            return True
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, ASSET_MODULE_KEY):
            return True
        if self._rbac.has_permission(ctx.user_id, ctx.tenant_id, "asset.module:admin"):
            return True
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            return False
        return self.is_platform_admin_email(user.email)

    def ensure_admin(self, ctx: TenantContext) -> None:
        from core.exceptions import ForbiddenException

        if not self.is_admin(ctx):
            raise ForbiddenException("Assets module admin access required")
