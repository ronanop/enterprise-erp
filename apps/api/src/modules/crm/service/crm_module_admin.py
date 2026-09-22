"""CRM module admin - ERP admins, platform emails, or assigned CRM module admins."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import ForbiddenException
from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository

CRM_MODULE_KEY = "crm"


class CrmModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)

    @staticmethod
    def is_admin_email(email: str | None) -> bool:
        if not email:
            return False
        return email.strip().lower() in settings.microsoft_platform_admin_email_set()

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if CRM_MODULE_KEY in ctx.admin_module_keys:
            return True
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, CRM_MODULE_KEY):
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
        return self.is_admin_email(user.email)

    def ensure_admin(self, ctx: TenantContext) -> None:
        if not self.is_admin(ctx):
            raise ForbiddenException("CRM module admin access required")

    def list_admin_user_ids(self, tenant_id: UUID) -> list[UUID]:
        """CRM module admins + ERP admins (by user_type).

        Same fan-out set used for My Jobs admin copies — not TENANT_ADMIN role
        codes, which are widely assigned.
        """
        ids: set[UUID] = set(
            self._modules.list_admin_user_ids_for_module(tenant_id, CRM_MODULE_KEY)
        )
        erp_admin_stmt = select(SecUser.id).where(
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
            SecUser.status == "active",
            SecUser.user_type.in_(tuple(ADMIN_USER_TYPES)),
        )
        ids.update(self._db.scalars(erp_admin_stmt).all())
        return list(ids)
