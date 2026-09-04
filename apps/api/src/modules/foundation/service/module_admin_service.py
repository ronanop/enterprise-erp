"""Module admin membership — assign Entra users to a single ERP module."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, ForbiddenException, NotFoundException
from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    ERP_MODULE_KEY_SET,
    MODULE_ROLE_ADMIN,
    MODULE_ROLE_MEMBER,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.org_module_admin_sync_service import (
    SERVICE_TEAM_JOB_ROLES,
    OrgModuleAdminSyncService,
)


class ModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)
        self._users = UserRepository(db)
        self._audit = AuditService(db)

    def ensure_module_admin(self, ctx: TenantContext, module_key: str) -> None:
        self._require_known_module(module_key)
        if ctx.user_id is None:
            raise ForbiddenException("Only a module admin can manage users for this module")
        if ctx.user_type in ADMIN_USER_TYPES:
            return
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, module_key):
            return
        raise ForbiddenException("Only a module admin can manage users for this module")

    def is_module_admin(self, ctx: TenantContext, module_key: str) -> bool:
        if ctx.user_id is None or module_key not in ERP_MODULE_KEY_SET:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        return self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, module_key)

    def list_members(self, ctx: TenantContext, module_key: str) -> list[dict]:
        self.ensure_module_admin(ctx, module_key)
        rows = self._modules.list_rows_for_module(ctx.tenant_id, module_key)
        user_ids = [row.user_id for row in rows]
        users = self._users_by_ids(ctx.tenant_id, user_ids)
        job_roles: dict[UUID, str] = {}
        if module_key == "service" and user_ids:
            job_roles = OrgModuleAdminSyncService(self._db).service_job_roles_for_users(
                ctx.tenant_id, user_ids
            )
        out: list[dict] = []
        for row in rows:
            user = users.get(row.user_id)
            if user is None:
                continue
            role = row.role or MODULE_ROLE_MEMBER
            item: dict = {
                "user_id": user.id,
                "display_name": user.display_name,
                "email": user.email,
                "role": role,
                "status": user.status,
                "service_job_role": None,
            }
            if module_key == "service" and role != MODULE_ROLE_ADMIN:
                item["service_job_role"] = job_roles.get(user.id, "service_engineer")
            out.append(item)
        out.sort(key=lambda item: (item["role"] != MODULE_ROLE_ADMIN, str(item["display_name"]).lower()))
        return out

    def list_assignable_users(self, ctx: TenantContext, module_key: str) -> list[dict]:
        self.ensure_module_admin(ctx, module_key)
        assigned_ids = self._modules.list_user_ids_for_module(ctx.tenant_id, module_key)
        stmt = (
            select(SecUser)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
            )
            .order_by(func.lower(SecUser.display_name).asc())
        )
        options: list[dict] = []
        for user in self._db.scalars(stmt).all():
            email = (user.email or "").strip().lower()
            if email.endswith("@example.com"):
                continue
            if user.user_type in ADMIN_USER_TYPES:
                continue
            if user.id in assigned_ids:
                continue
            options.append(
                {
                    "user_id": user.id,
                    "display_name": user.display_name,
                    "email": user.email,
                }
            )
        return options

    def add_member(
        self,
        ctx: TenantContext,
        module_key: str,
        user_id: UUID,
        service_job_role: str | None = None,
    ) -> dict:
        self.ensure_module_admin(ctx, module_key)
        if ctx.user_id is not None and user_id == ctx.user_id:
            raise AppException("You already administer this module")
        target = self._users.get_by_id(ctx.tenant_id, user_id)
        if target is None:
            raise NotFoundException("User not found")
        if target.user_type in ADMIN_USER_TYPES:
            raise AppException("ERP admins already have access to every module")
        existing = self._modules.get_assignment(ctx.tenant_id, user_id, module_key)
        if existing is not None:
            raise ConflictException("User already has this module")

        resolved_job: str | None = None
        if module_key == "service":
            resolved_job = (service_job_role or "service_engineer").strip().lower()
            if resolved_job not in SERVICE_TEAM_JOB_ROLES:
                raise AppException(
                    "service_job_role must be service_engineer or field_engineer"
                )

        self._modules.add_member(
            tenant_id=ctx.tenant_id,
            user_id=user_id,
            module_key=module_key,
            assigned_by=ctx.user_id,
        )
        if module_key == "service" and resolved_job is not None:
            try:
                OrgModuleAdminSyncService(self._db).assign_service_team_role(
                    ctx, user_id, resolved_job, ctx.user_id
                )
            except ValueError as exc:
                raise AppException(str(exc)) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "module_key": module_key,
                "role": MODULE_ROLE_MEMBER,
                "service_job_role": resolved_job,
            },
        )
        return {
            "user_id": target.id,
            "display_name": target.display_name,
            "email": target.email,
            "role": MODULE_ROLE_MEMBER,
            "status": target.status,
            "service_job_role": resolved_job,
        }

    def update_member_service_role(
        self,
        ctx: TenantContext,
        module_key: str,
        user_id: UUID,
        service_job_role: str,
    ) -> dict:
        self.ensure_module_admin(ctx, module_key)
        if module_key != "service":
            raise AppException("Service job roles apply only to the Service module")
        row = self._modules.get_assignment(ctx.tenant_id, user_id, module_key)
        if row is None:
            raise NotFoundException("User is not assigned to this module")
        if row.role == MODULE_ROLE_ADMIN:
            raise ForbiddenException("Cannot change job role for module admins")
        target = self._users.get_by_id(ctx.tenant_id, user_id)
        if target is None:
            raise NotFoundException("User not found")
        role_key = (service_job_role or "").strip().lower()
        if role_key not in SERVICE_TEAM_JOB_ROLES:
            raise AppException(
                "service_job_role must be service_engineer or field_engineer"
            )
        try:
            OrgModuleAdminSyncService(self._db).assign_service_team_role(
                ctx, user_id, role_key, ctx.user_id
            )
        except ValueError as exc:
            raise AppException(str(exc)) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={"module_key": module_key, "service_job_role": role_key},
        )
        return {
            "user_id": target.id,
            "display_name": target.display_name,
            "email": target.email,
            "role": MODULE_ROLE_MEMBER,
            "status": target.status,
            "service_job_role": role_key,
        }

    def remove_member(self, ctx: TenantContext, module_key: str, user_id: UUID) -> None:
        self.ensure_module_admin(ctx, module_key)
        row = self._modules.get_assignment(ctx.tenant_id, user_id, module_key)
        if row is None:
            raise NotFoundException("User is not assigned to this module")
        if row.role == MODULE_ROLE_ADMIN:
            raise ForbiddenException("Module admins are assigned from Organization users")
        self._modules.delete_assignment(row)
        if module_key == "service":
            OrgModuleAdminSyncService(self._db).demote_service_engineer(
                ctx.tenant_id, user_id, ctx.user_id
            )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="delete",
            performed_by=ctx.user_id,
            new_value={"module_key": module_key, "role": MODULE_ROLE_MEMBER},
        )

    def _users_by_ids(self, tenant_id: UUID, user_ids: list[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        stmt = select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.id.in_(user_ids),
            SecUser.is_deleted.is_(False),
        )
        return {user.id: user for user in self._db.scalars(stmt).all()}

    @staticmethod
    def _require_known_module(module_key: str) -> None:
        if module_key not in ERP_MODULE_KEY_SET:
            raise AppException(f"Unknown module key: {module_key}")
