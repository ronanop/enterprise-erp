"""HRMS module admin — ERP admins, org-assigned module admins, or HR_ADMIN role."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.repository.user_module_repository import UserModuleRepository

HR_MODULE_KEY = "hr"
HR_ADMIN_ROLE_CODE = "HR_ADMIN"


class HrModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)

    @staticmethod
    def is_platform_admin_email(email: str | None) -> bool:
        if not email:
            return False
        return email.strip().lower() in settings.microsoft_platform_admin_email_set()

    def has_hr_admin_role(self, tenant_id, user_id) -> bool:
        role_id = self._db.scalar(
            select(SecRole.id).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == HR_ADMIN_ROLE_CODE,
                SecRole.is_deleted.is_(False),
            )
        )
        if role_id is None:
            return False
        link = self._db.scalar(
            select(SecUserRole.id).where(
                SecUserRole.user_id == user_id,
                SecUserRole.role_id == role_id,
            )
        )
        return link is not None

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if HR_MODULE_KEY in ctx.admin_module_keys:
            return True
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, HR_MODULE_KEY):
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
            raise ForbiddenException("HR module admin access required")
