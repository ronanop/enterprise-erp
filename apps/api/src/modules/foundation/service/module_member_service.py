"""Users assigned to an ERP module, mapped to master_employee for pickers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES, ERP_MODULE_KEY_SET
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser, SecUserModule
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService


class ModuleMemberService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._user_employees = UserEmployeeLinkService(db)

    def list_user_options(self, ctx: TenantContext, module_key: str) -> list[dict]:
        return [
            {
                "id": user.id,
                "display_name": user.display_name,
                "email": user.email,
            }
            for user in self._list_module_users(ctx, module_key)
        ]

    def list_member_options(self, ctx: TenantContext, module_key: str) -> list[dict]:
        if module_key not in ERP_MODULE_KEY_SET:
            return []

        options: list[dict] = []
        seen_employee_ids: set[UUID] = set()

        for user in self._list_module_users(ctx, module_key):
            employee = self._user_employees.find_employee_for_user(ctx, user)
            if employee is None:
                employee = self._user_employees.ensure_employee_for_user(ctx, user)
            if employee is None or employee.id in seen_employee_ids:
                continue
            seen_employee_ids.add(employee.id)
            name = f"{employee.first_name} {employee.last_name}".strip() or user.display_name
            code = employee.employee_code.strip() if employee.employee_code else ""
            label = f"{name} ({code})" if code else name
            options.append(
                {
                    "id": employee.id,
                    "label": label,
                    "email": user.email,
                    "user_id": user.id,
                }
            )

        options.sort(key=lambda row: row["label"].lower())
        return options

    def _list_module_users(self, ctx: TenantContext, module_key: str) -> list[SecUser]:
        tenant_id = ctx.tenant_id
        module_user_ids = set(
            self._db.scalars(
                select(SecUserModule.user_id).where(
                    SecUserModule.tenant_id == tenant_id,
                    SecUserModule.module_key == module_key,
                )
            ).all()
        )

        stmt = (
            select(SecUser)
            .where(
                SecUser.tenant_id == tenant_id,
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
            )
            .order_by(SecUser.display_name.asc())
        )
        users: list[SecUser] = []
        for user in self._db.scalars(stmt).all():
            email = (user.email or "").strip().lower()
            if email.endswith("@example.com"):
                continue
            if user.user_type in ADMIN_USER_TYPES or user.id in module_user_ids:
                users.append(user)
        return users
