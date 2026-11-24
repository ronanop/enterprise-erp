"""ERP-admin module access: grant a user Admin or User on one module.

Admin grants go through UserService.set_user_modules and member grants through
ModuleAdminService, so Organization → Users and every module Users tab stay on the
same sec_user_module rows and side effects.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.entities import UserEntity
from modules.foundation.domain.erp_modules import (
    ASSET_MODULE_KEY,
    ASSET_SUBMODULE_KEYS,
    ERP_MODULE_KEY_SET,
    MODULE_ROLE_ADMIN,
    MODULE_ROLE_MEMBER,
    asset_domain_for_module_key,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.service.module_admin_service import ModuleAdminService
from modules.foundation.service.user_service import UserService


class ModuleAccessService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._members = ModuleAdminService(db)
        self._modules = UserModuleRepository(db)

    @staticmethod
    def _require_module(module_key: str) -> str:
        key = (module_key or "").strip()
        if key not in ERP_MODULE_KEY_SET:
            raise AppException(f"Unknown module key: {module_key}")
        return key

    def _set_admin(self, ctx: TenantContext, user: UserEntity, module_key: str, *, grant: bool) -> None:
        keys = set(user.admin_module_keys)
        if grant:
            keys.add(module_key)
        else:
            keys.discard(module_key)
        self._users.set_user_modules(
            tenant_id=ctx.tenant_id,
            user_id=user.id,
            module_keys=sorted(keys),
            updated_by=ctx.user_id,
        )

    def grant(
        self,
        ctx: TenantContext,
        user_id: UUID,
        *,
        module_key: str | None = None,
        module_keys: list[str] | None = None,
        role: str,
        service_job_role: str | None = None,
    ) -> UserEntity:
        """Grant Admin/User on one or more modules; send a single access email."""
        self._users.require_erp_admin(ctx.tenant_id, ctx.user_id)
        keys: list[str] = []
        seen: set[str] = set()
        for raw in [*(module_keys or []), module_key or ""]:
            if not (raw or "").strip():
                continue
            key = self._require_module(raw)
            if key in seen:
                continue
            seen.add(key)
            keys.append(key)
        if not keys:
            raise AppException("At least one module_key is required")

        user = self._users.get_user(ctx.tenant_id, user_id)
        first_module = not (user.assigned_module_keys or user.admin_module_keys)
        granted: list[str] = []

        for key in keys:
            existing = self._modules.get_assignment(ctx.tenant_id, user_id, key)
            current = (existing.role or MODULE_ROLE_MEMBER) if existing else None
            user = self._users.get_user(ctx.tenant_id, user_id)

            if role == MODULE_ROLE_ADMIN:
                if current == MODULE_ROLE_ADMIN:
                    continue
                self._set_admin(ctx, user, key, grant=True)
                self._sync_asset_domain(ctx, user_id, key, MODULE_ROLE_ADMIN)
                granted.append(key)
            elif role == MODULE_ROLE_MEMBER:
                if current is not None and current != MODULE_ROLE_ADMIN:
                    continue
                if current == MODULE_ROLE_ADMIN:
                    self._set_admin(ctx, user, key, grant=False)
                self._members.add_member(
                    ctx,
                    key,
                    user_id,
                    service_job_role if key == "service" else None,
                )
                self._sync_asset_domain(ctx, user_id, key, MODULE_ROLE_MEMBER)
                granted.append(key)
            else:
                raise AppException("role must be admin or member")

        if not granted:
            label = "admin" if role == MODULE_ROLE_ADMIN else "user"
            raise ConflictException(
                f"User already has {label} access to the selected module(s)"
            )

        updated = self._users.get_user(ctx.tenant_id, user_id)
        self._notify_access_emails(
            ctx,
            user_id=user_id,
            module_keys=granted,
            role=role,
            first_module=first_module,
        )
        return updated

    def _notify_access_emails(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        module_keys: list[str],
        role: str,
        first_module: bool,
    ) -> None:
        try:
            from modules.foundation.models.security import SecUser
            from modules.foundation.service.org_access_email_service import OrgAccessEmailService
            from modules.foundation.service.user_service import DEFAULT_TEMPORARY_PASSWORD
            from security.password import PasswordHasher

            row = self._db.get(SecUser, user_id)
            if row is None or row.is_deleted:
                return
            mail = OrgAccessEmailService(self._db)
            if first_module:
                # Ensure a known temp password and welcome the user with credentials.
                row.password_hash = PasswordHasher.hash_password(DEFAULT_TEMPORARY_PASSWORD)
                row.must_change_password = True
                row.failed_login_count = 0
                row.locked_until = None
                if row.status == "locked":
                    row.status = "active"
                self._db.flush()
                mail.notify_welcome(
                    tenant_id=ctx.tenant_id,
                    user=row,
                    module_keys=module_keys,
                    role=role,
                    temporary_password=DEFAULT_TEMPORARY_PASSWORD,
                    created_by=ctx.user_id,
                )
            else:
                mail.notify_module_assigned(
                    tenant_id=ctx.tenant_id,
                    user=row,
                    module_keys=module_keys,
                    role=role,
                    created_by=ctx.user_id,
                )
        except Exception:  # noqa: BLE001 - never block access grants on mail
            pass

    def revoke(self, ctx: TenantContext, user_id: UUID, *, module_key: str) -> UserEntity:
        self._users.require_erp_admin(ctx.tenant_id, ctx.user_id)
        key = self._require_module(module_key)
        user = self._users.get_user(ctx.tenant_id, user_id)
        existing = self._modules.get_assignment(ctx.tenant_id, user_id, key)
        if existing is None:
            raise NotFoundException("User has no access to this module")
        if (existing.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN:
            self._set_admin(ctx, user, key, grant=False)
        else:
            self._members.remove_member(ctx, key, user_id)
        self._revoke_asset_domain(ctx, user_id, key)
        return self._users.get_user(ctx.tenant_id, user_id)

    def _sync_asset_domain(
        self, ctx: TenantContext, user_id: UUID, module_key: str, role: str
    ) -> None:
        if module_key == ASSET_MODULE_KEY:
            # Legacy parent grant → both IT and Non-IT domains.
            from modules.asset.service.domain_membership_service import DomainMembershipService

            domains = DomainMembershipService(self._db)
            for sub in sorted(ASSET_SUBMODULE_KEYS):
                domains.upsert_from_module_grant(
                    ctx,
                    user_id=user_id,
                    module_key=sub,
                    role=role,
                    actor_id=ctx.user_id,
                )
            return
        if asset_domain_for_module_key(module_key) is None:
            return
        from modules.asset.service.domain_membership_service import DomainMembershipService

        DomainMembershipService(self._db).upsert_from_module_grant(
            ctx,
            user_id=user_id,
            module_key=module_key,
            role=role,
            actor_id=ctx.user_id,
        )

    def _revoke_asset_domain(self, ctx: TenantContext, user_id: UUID, module_key: str) -> None:
        from modules.asset.service.domain_membership_service import DomainMembershipService

        domains = DomainMembershipService(self._db)
        if module_key == ASSET_MODULE_KEY:
            domains.deactivate_all_for_user(
                ctx.tenant_id, user_id, actor_id=ctx.user_id
            )
            return
        if asset_domain_for_module_key(module_key) is None:
            return
        domains.revoke_from_module_grant(
            ctx,
            user_id=user_id,
            module_key=module_key,
            actor_id=ctx.user_id,
        )
