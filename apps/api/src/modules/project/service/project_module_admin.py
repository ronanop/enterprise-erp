"""Project Management module admin - ERP admins (DB user_type) or assigned module admins."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository

PROJECT_MODULE_KEY = "projects"


@dataclass(frozen=True)
class ProjectModuleAdminRecipient:
    user_id: UUID | None
    email: str
    display_name: str
    employee_id: UUID | None


class ProjectModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if PROJECT_MODULE_KEY in ctx.admin_module_keys:
            return True
        return self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, PROJECT_MODULE_KEY)

    def ensure_admin(self, ctx: TenantContext) -> None:
        from core.exceptions import ForbiddenException

        if not self.is_admin(ctx):
            raise ForbiddenException(
                "Only the Project Management module admin can perform this action"
            )

    def list_admin_recipients(self, tenant_id: UUID) -> list[ProjectModuleAdminRecipient]:
        """ERP admins (by user_type) plus users assigned as Projects module admins."""
        admin_ids = self._modules.list_admin_user_ids_for_module(tenant_id, PROJECT_MODULE_KEY)
        conditions = [
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
            SecUser.status == "active",
        ]
        type_match = SecUser.user_type.in_(tuple(ADMIN_USER_TYPES))
        if admin_ids:
            stmt = select(SecUser).where(*conditions, or_(type_match, SecUser.id.in_(admin_ids)))
        else:
            stmt = select(SecUser).where(*conditions, type_match)

        rows = list(self._db.scalars(stmt).all())
        out: list[ProjectModuleAdminRecipient] = []
        seen: set[UUID] = set()
        for user in rows:
            if user.id in seen:
                continue
            seen.add(user.id)
            email = (user.email or "").strip().lower()
            out.append(
                ProjectModuleAdminRecipient(
                    user_id=user.id,
                    email=email,
                    display_name=(user.display_name or email).strip() or email,
                    employee_id=user.employee_id,
                )
            )
        return out
