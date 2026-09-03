"""Procurement module admin — ERP admins or org-assigned procurement module admins."""

from __future__ import annotations

from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_module_repository import UserModuleRepository

PROCUREMENT_MODULE_KEY = "procurement"


class ProcurementModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._modules = UserModuleRepository(db)

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if PROCUREMENT_MODULE_KEY in ctx.admin_module_keys:
            return True
        return self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, PROCUREMENT_MODULE_KEY)

    def ensure_admin(self, ctx: TenantContext) -> None:
        from core.exceptions import ForbiddenException

        if not self.is_admin(ctx):
            raise ForbiddenException("Procurement module admin access required")
