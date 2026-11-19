"""User service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.exceptions import ErpAdminRequiredException
from modules.foundation.domain.erp_modules import (
    ADMIN_USER_TYPES,
    ERP_MODULE_KEYS,
    ERP_MODULE_KEY_SET,
    MODULE_ROLE_ADMIN,
    effective_admin_module_keys,
    effective_module_keys,
    has_all_modules_admin,
    resolve_session_user_type,
)
from modules.foundation.domain.entities import UserEntity
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.service.hrms_user_directory import HrmsUserDirectory
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.schemas import UserResponse
from modules.organization.models.company import OrgCompany
from modules.organization.repository.org_scope_repository import OrgScopeRepository
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.foundation.service.rbac_service import RBACService
from security.password import PasswordHasher

# Shared temporary password issued by ERP admins from Organization → Users.
# Avoid "@" — email clients linkify it and users copy a broken password.
DEFAULT_TEMPORARY_PASSWORD = "CacheDigi#123"


class UserService:
    def __init__(self, db: Session) -> None:
        self._repo = UserRepository(db)
        self._modules = UserModuleRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = PlatformAuditFacade(db)
        self._rbac = RBACService(db)

    @staticmethod
    def to_response(
        user: UserEntity,
        *,
        employee_code: str | None = None,
        hrms_valid: bool = False,
    ) -> UserResponse:
        resolved_type = resolve_session_user_type(
            user.user_type,
            user.email,
            user.role_codes,
        )
        return UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            display_name=user.display_name,
            employee_id=user.employee_id,
            user_type=resolved_type,
            status=user.status,
            mfa_enabled=user.mfa_enabled,
            role_ids=user.role_ids,
            assigned_module_keys=list(user.assigned_module_keys),
            admin_module_keys=list(user.admin_module_keys),
            must_change_password=user.must_change_password,
            employee_code=employee_code,
            hrms_valid=hrms_valid,
        )

    def list_user_responses(self, tenant_id: UUID) -> list[UserResponse]:
        links = HrmsUserDirectory(self._modules.db).links_by_user(tenant_id)
        out: list[UserResponse] = []
        for user in self.list_users(tenant_id):
            link = links.get(user.id)
            out.append(
                self.to_response(
                    user,
                    employee_code=link.employee_code if link else None,
                    hrms_valid=bool(link and link.valid),
                )
            )
        return out

    def require_erp_admin(self, tenant_id: UUID, actor_id: UUID | None) -> UserEntity:
        actor = self._repo.get_by_id(tenant_id, actor_id) if actor_id is not None else None
        if actor is None or not self._is_erp_platform_admin(actor):
            raise ErpAdminRequiredException()
        return actor

    def apply_erp_admin_defaults(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        actor_id: UUID | None = None,
        default_company_id: UUID | None = None,
    ) -> None:
        """ERP admins get every active entity and every sidebar module by default."""
        company_ids = list(
            self._modules.db.scalars(
                select(OrgCompany.id).where(
                    OrgCompany.tenant_id == tenant_id,
                    OrgCompany.is_deleted.is_(False),
                )
            ).all()
        )
        ctx = TenantContext(tenant_id=tenant_id, user_id=actor_id or user_id, user_type="super_admin")
        if company_ids:
            OrgScopeRepository(self._modules.db).replace_company_scopes(
                ctx,
                user_id=user_id,
                company_ids=company_ids,
                default_company_id=default_company_id,
            )
        # Explicit module-admin rows so Organization / audit views show full sidebar access.
        self._modules.replace_admin_keys(
            tenant_id=tenant_id,
            user_id=user_id,
            module_keys=list(ERP_MODULE_KEYS),
            assigned_by=actor_id,
        )
        self._rbac.invalidate_user(user_id)

    def issue_temporary_password(
        self, tenant_id: UUID, user_id: UUID, *, actor_id: UUID | None
    ) -> tuple[UserEntity, str]:
        """ERP admin issues the default temporary password; user must change it after sign-in."""
        self.require_erp_admin(tenant_id, actor_id)
        from modules.foundation.models.security import SecUser

        row = self._repo.db.get(SecUser, user_id)
        if row is None or row.is_deleted or row.tenant_id != tenant_id:
            raise NotFoundException("User not found")
        password = DEFAULT_TEMPORARY_PASSWORD
        row.password_hash = PasswordHasher.hash_password(password)
        row.must_change_password = True
        row.failed_login_count = 0
        row.locked_until = None
        if row.status == "locked":
            row.status = "active"
        self._repo.db.flush()
        self._sessions.revoke_all_for_user(tenant_id, user_id, revoked_by=actor_id)
        self._audit.log_security_event(
            tenant_id=tenant_id,
            event_type="auth.temporary_password_issued",
            user_id=user_id,
        )
        try:
            from modules.foundation.service.org_access_email_service import OrgAccessEmailService

            OrgAccessEmailService(self._repo.db).notify_temporary_password(
                tenant_id=tenant_id,
                user=row,
                temporary_password=password,
                created_by=actor_id,
            )
        except Exception:  # noqa: BLE001
            pass
        return self.get_user(tenant_id, user_id), password

    def effective_modules_for_user(self, user: UserEntity) -> list[str]:
        return effective_module_keys(user.user_type, user.assigned_module_keys, user.role_codes)

    def effective_admin_modules_for_user(self, user: UserEntity) -> list[str]:
        return effective_admin_module_keys(user.user_type, user.admin_module_keys, user.role_codes)

    def get_user_modules(self, tenant_id: UUID, user_id: UUID) -> tuple[UserEntity, list[str], list[str], list[str]]:
        user = self.get_user(tenant_id, user_id)
        assigned = list(user.assigned_module_keys)
        admin_keys = list(user.admin_module_keys)
        effective = self.effective_modules_for_user(user)
        return user, assigned, admin_keys, effective

    @staticmethod
    def _is_erp_platform_admin(user: UserEntity) -> bool:
        return user.user_type in ADMIN_USER_TYPES

    def set_user_modules(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        module_keys: list[str],
        updated_by: UUID | None,
    ) -> UserEntity:
        """Replace a user's module-admin grants. Module admins are managed by ERP admins only."""
        self.require_erp_admin(tenant_id, updated_by)
        user = self.get_user(tenant_id, user_id)
        if self._is_erp_platform_admin(user):
            raise AppException("ERP admin module access cannot be changed")

        previous_admin_keys = list(user.admin_module_keys)
        normalized = sorted({k.strip() for k in module_keys if k and k.strip()})
        invalid = [k for k in normalized if k not in ERP_MODULE_KEY_SET]
        if invalid:
            raise AppException(f"Unknown module keys: {', '.join(invalid)}")
        if normalized and not set(normalized).issubset(previous_admin_keys):
            if not HrmsUserDirectory(self._modules.db).is_valid_user(tenant_id, user_id):
                raise AppException(
                    "Only HRMS onboarded employees with a valid employee id can get module access"
                )

        granting_all = has_all_modules_admin(normalized)

        # Explicit All-modules grant always stores the full key set.
        if granting_all:
            normalized = list(ERP_MODULE_KEYS)

        self._modules.replace_admin_keys(
            tenant_id=tenant_id,
            user_id=user_id,
            module_keys=normalized,
            assigned_by=updated_by,
        )
        from modules.foundation.service.org_module_admin_sync_service import OrgModuleAdminSyncService

        OrgModuleAdminSyncService(self._modules.db).sync_user_admin_modules(
            tenant_id,
            user_id,
            previous_admin_keys=previous_admin_keys,
            new_admin_keys=normalized,
            actor_id=updated_by,
        )
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="update",
            performed_by=updated_by,
            new_value={"admin_module_keys": normalized},
        )
        newly_granted = sorted(set(normalized) - set(previous_admin_keys))
        if newly_granted:
            self._notify_admin_module_emails(
                tenant_id=tenant_id,
                user_id=user_id,
                newly_granted=newly_granted,
                first_module=not (previous_admin_keys or user.assigned_module_keys),
                actor_id=updated_by,
            )
        return self.get_user(tenant_id, user_id)

    def _notify_admin_module_emails(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        newly_granted: list[str],
        first_module: bool,
        actor_id: UUID | None,
    ) -> None:
        try:
            from modules.foundation.models.security import SecUser
            from modules.foundation.service.org_access_email_service import OrgAccessEmailService
            from security.password import PasswordHasher

            row = self._repo.db.get(SecUser, user_id)
            if row is None or row.is_deleted:
                return
            mail = OrgAccessEmailService(self._repo.db)
            module_label = (
                "All modules"
                if len(newly_granted) >= len(ERP_MODULE_KEYS)
                else newly_granted[0]
            )
            if first_module:
                row.password_hash = PasswordHasher.hash_password(DEFAULT_TEMPORARY_PASSWORD)
                row.must_change_password = True
                row.failed_login_count = 0
                row.locked_until = None
                if row.status == "locked":
                    row.status = "active"
                self._repo.db.flush()
                mail.notify_welcome(
                    tenant_id=tenant_id,
                    user=row,
                    module_key=module_label if module_label != "All modules" else "*",
                    role=MODULE_ROLE_ADMIN,
                    temporary_password=DEFAULT_TEMPORARY_PASSWORD,
                    created_by=actor_id,
                )
            else:
                mail.notify_module_assigned(
                    tenant_id=tenant_id,
                    user=row,
                    module_key=module_label if module_label != "All modules" else "*",
                    role=MODULE_ROLE_ADMIN,
                    created_by=actor_id,
                )
        except Exception:  # noqa: BLE001
            pass

    def list_users(self, tenant_id: UUID):
        return self._repo.list_users(tenant_id)

    def get_user(self, tenant_id: UUID, user_id: UUID):
        user = self._repo.get_by_id(tenant_id, user_id)
        if user is None:
            raise NotFoundException("User not found")
        return user

    def create_user(
        self,
        *,
        tenant_id: UUID,
        email: str,
        password: str,
        display_name: str,
        user_type: str,
        created_by: UUID | None = None,
    ):
        if self._repo.get_by_email(tenant_id, email):
            raise ConflictException("Email already exists")
        password_hash = PasswordHasher.hash_password(password)
        user = self._repo.create(
            tenant_id=tenant_id,
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            user_type=user_type,
            created_by=created_by,
        )
        if user.user_type in ADMIN_USER_TYPES:
            self.apply_erp_admin_defaults(tenant_id, user.id, actor_id=created_by)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user",
            entity_id=user.id,
            operation="create",
            performed_by=created_by,
            new_value={"email": email, "display_name": display_name},
        )
        return user

    def update_user(self, tenant_id: UUID, user_id: UUID, updated_by: UUID | None = None, **fields):
        previous = self._repo.get_by_id(tenant_id, user_id)
        previous_type = previous.user_type if previous is not None else None
        user = self._repo.update(tenant_id, user_id, **fields)
        if user is None:
            raise NotFoundException("User not found")
        if (
            user.user_type in ADMIN_USER_TYPES
            and previous_type not in ADMIN_USER_TYPES
        ):
            self.apply_erp_admin_defaults(tenant_id, user_id, actor_id=updated_by)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user",
            entity_id=user_id,
            operation="update",
            performed_by=updated_by,
            new_value=fields,
        )
        return user

    def delete_user(self, tenant_id: UUID, user_id: UUID, deleted_by: UUID | None = None) -> None:
        if not self._repo.soft_delete(tenant_id, user_id, deleted_by=deleted_by):
            raise NotFoundException("User not found")
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user",
            entity_id=user_id,
            operation="delete",
            performed_by=deleted_by,
        )

    def assign_role(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        role_id: UUID,
        assigned_by: UUID | None,
    ) -> None:
        self._repo.assign_role(
            tenant_id=tenant_id,
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
        )
        self._rbac.invalidate_user(user_id)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user_role",
            entity_id=user_id,
            operation="create",
            performed_by=assigned_by,
            new_value={"role_id": str(role_id)},
        )

    def revoke_role(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        role_id: UUID,
        revoked_by: UUID | None = None,
    ) -> None:
        from sqlalchemy import select

        from modules.foundation.models.security import SecUserRole

        links = list(
            self._repo.db.scalars(
                select(SecUserRole).where(
                    SecUserRole.tenant_id == tenant_id,
                    SecUserRole.user_id == user_id,
                    SecUserRole.role_id == role_id,
                )
            ).all()
        )
        for link in links:
            self._repo.db.delete(link)
        self._repo.db.flush()
        self._rbac.invalidate_user(user_id)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user_role",
            entity_id=user_id,
            operation="delete",
            performed_by=revoked_by,
            new_value={"role_id": str(role_id)},
        )

    def revoke_all_sessions(
        self, tenant_id: UUID, user_id: UUID, revoked_by: UUID | None = None
    ) -> None:
        self._sessions.revoke_all_for_user(tenant_id, user_id, revoked_by=revoked_by)
        self._audit.log_security_event(
            tenant_id=tenant_id,
            event_type="auth.sessions_revoked",
            user_id=user_id,
        )
