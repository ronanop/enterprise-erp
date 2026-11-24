"""Module membership - module admins assign HRMS employees as users of their module."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, ForbiddenException, NotFoundException
from modules.asset.service.domain_membership_service import DomainMembershipService
from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    ASSET_MODULE_KEY,
    ASSET_SUBMODULE_KEYS,
    ERP_MODULE_KEY_SET,
    MODULE_ROLE_ADMIN,
    MODULE_ROLE_MEMBER,
    asset_domain_for_module_key,
    default_module_member_role,
    module_member_roles,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.foundation.service.hrms_user_directory import HrmsUserDirectory
from modules.foundation.service.org_module_admin_sync_service import (
    SERVICE_TEAM_JOB_ROLES,
    OrgModuleAdminSyncService,
)


class ModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._modules = UserModuleRepository(db)
        self._users = UserRepository(db)
        self._audit = PlatformAuditFacade(db)
        self._hrms = HrmsUserDirectory(db)

    def ensure_module_admin(self, ctx: TenantContext, module_key: str) -> None:
        self._require_known_module(module_key)
        if ctx.user_id is None:
            raise ForbiddenException("Only a module admin can manage users for this module")
        if ctx.user_type in ADMIN_USER_TYPES:
            return
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, module_key):
            return
        # Parent Asset Management admins may manage IT / Non-IT submodule users.
        if module_key in ASSET_SUBMODULE_KEYS and self._modules.is_module_admin(
            ctx.tenant_id, ctx.user_id, ASSET_MODULE_KEY
        ):
            return
        raise ForbiddenException("Only a module admin can manage users for this module")

    def is_module_admin(self, ctx: TenantContext, module_key: str) -> bool:
        if ctx.user_id is None or module_key not in ERP_MODULE_KEY_SET:
            return False
        if ctx.user_type in ADMIN_USER_TYPES:
            return True
        if self._modules.is_module_admin(ctx.tenant_id, ctx.user_id, module_key):
            return True
        if module_key in ASSET_SUBMODULE_KEYS:
            return self._modules.is_module_admin(
                ctx.tenant_id, ctx.user_id, ASSET_MODULE_KEY
            )
        return False

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
        """All HRMS onboarded employees (valid employee id), including those already on this module."""
        self.ensure_module_admin(ctx, module_key)
        assigned_ids = self._modules.list_user_ids_for_module(ctx.tenant_id, module_key)
        links = self._hrms.links_by_user(ctx.tenant_id)
        valid_ids = {uid for uid, link in links.items() if link.valid}
        if not valid_ids:
            return []
        stmt = (
            select(SecUser)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.id.in_(valid_ids),
                SecUser.is_deleted.is_(False),
                SecUser.status != "inactive",
            )
            .order_by(func.lower(SecUser.display_name).asc())
        )
        return [
            {
                "user_id": user.id,
                "display_name": user.display_name,
                "email": user.email,
                "employee_code": links[user.id].employee_code,
                "already_assigned": user.id in assigned_ids,
            }
            for user in self._db.scalars(stmt).all()
            if user.user_type not in ADMIN_USER_TYPES
        ]

    def add_member(
        self,
        ctx: TenantContext,
        module_key: str,
        user_id: UUID,
        service_job_role: str | None = None,
        role: str | None = None,
    ) -> dict:
        self.ensure_module_admin(ctx, module_key)
        if ctx.user_id is not None and user_id == ctx.user_id:
            raise AppException("You already administer this module")
        target = self._users.get_by_id(ctx.tenant_id, user_id)
        if target is None:
            raise NotFoundException("User not found")
        if target.user_type in ADMIN_USER_TYPES:
            raise AppException("ERP admins already have access to every module")
        if not self._hrms.is_valid_user(ctx.tenant_id, user_id):
            raise AppException(
                "Only HRMS onboarded employees with a valid employee id can be assigned"
            )
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

        member_role = self._resolve_member_role(module_key, role)

        self._modules.add_member(
            tenant_id=ctx.tenant_id,
            user_id=user_id,
            module_key=module_key,
            assigned_by=ctx.user_id,
            role=member_role,
        )
        if module_key == "service" and resolved_job is not None:
            try:
                OrgModuleAdminSyncService(self._db).assign_service_team_role(
                    ctx, user_id, resolved_job, ctx.user_id
                )
            except ValueError as exc:
                raise AppException(str(exc)) from exc
        if module_key == "crm":
            OrgModuleAdminSyncService(self._db).promote_crm_member(
                ctx.tenant_id, user_id, ctx.user_id
            )
        if module_key == ASSET_MODULE_KEY:
            domains = DomainMembershipService(self._db)
            for sub in sorted(ASSET_SUBMODULE_KEYS):
                domains.upsert_from_module_grant(
                    ctx,
                    user_id=user_id,
                    module_key=sub,
                    role=member_role,
                    actor_id=ctx.user_id,
                )
        elif asset_domain_for_module_key(module_key) is not None:
            DomainMembershipService(self._db).upsert_from_module_grant(
                ctx,
                user_id=user_id,
                module_key=module_key,
                role=member_role,
                actor_id=ctx.user_id,
            )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "module_key": module_key,
                "role": member_role,
                "service_job_role": resolved_job,
            },
        )
        return {
            "user_id": target.id,
            "display_name": target.display_name,
            "email": target.email,
            "role": member_role,
            "status": target.status,
            "service_job_role": resolved_job,
        }

    def update_member_role(
        self,
        ctx: TenantContext,
        module_key: str,
        user_id: UUID,
        role: str,
    ) -> dict:
        """Update functional team role (e.g. Marketing head / associate / video editor)."""
        self.ensure_module_admin(ctx, module_key)
        row = self._modules.get_assignment(ctx.tenant_id, user_id, module_key)
        if row is None:
            raise NotFoundException("User is not assigned to this module")
        if row.role == MODULE_ROLE_ADMIN:
            raise ForbiddenException("Cannot change role for module admins")
        target = self._users.get_by_id(ctx.tenant_id, user_id)
        if target is None:
            raise NotFoundException("User not found")
        member_role = self._resolve_member_role(module_key, role, require_explicit=True)
        old_role = row.role
        self._modules.update_role(row, member_role)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="update",
            performed_by=ctx.user_id,
            old_value={"module_key": module_key, "role": old_role},
            new_value={"module_key": module_key, "role": member_role},
        )
        return {
            "user_id": target.id,
            "display_name": target.display_name,
            "email": target.email,
            "role": member_role,
            "status": target.status,
            "service_job_role": None,
        }

    @staticmethod
    def _resolve_member_role(
        module_key: str,
        role: str | None,
        *,
        require_explicit: bool = False,
    ) -> str:
        allowed = module_member_roles(module_key)
        if role is None or not str(role).strip():
            if require_explicit:
                raise AppException("Role is required")
            return default_module_member_role(module_key)
        role_key = str(role).strip().lower()
        if role_key == MODULE_ROLE_ADMIN:
            raise AppException("Module admins are assigned only from Organization → Users")
        if role_key not in allowed:
            raise AppException(
                f"Invalid role for {module_key}. Allowed: {', '.join(sorted(allowed))}"
            )
        return role_key

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
        if module_key == "crm":
            OrgModuleAdminSyncService(self._db).demote_crm_member(
                ctx.tenant_id, user_id, ctx.user_id
            )
        if module_key == ASSET_MODULE_KEY:
            # Clear IT/Non-IT domain memberships so list_users sync cannot re-add this member.
            DomainMembershipService(self._db).deactivate_all_for_user(
                ctx.tenant_id, user_id, actor_id=ctx.user_id
            )
        elif asset_domain_for_module_key(module_key) is not None:
            DomainMembershipService(self._db).revoke_from_module_grant(
                ctx,
                user_id=user_id,
                module_key=module_key,
                actor_id=ctx.user_id,
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
