"""User service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.erp_modules import (
    ERP_MODULE_KEY_SET,
    effective_admin_module_keys,
    effective_module_keys,
)
from modules.foundation.domain.entities import UserEntity
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.schemas import UserResponse
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.rbac_service import RBACService
from security.password import PasswordHasher


class UserService:
    def __init__(self, db: Session) -> None:
        self._repo = UserRepository(db)
        self._modules = UserModuleRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)
        self._rbac = RBACService(db)

    @staticmethod
    def to_response(user: UserEntity) -> UserResponse:
        return UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            display_name=user.display_name,
            employee_id=user.employee_id,
            user_type=user.user_type,
            status=user.status,
            mfa_enabled=user.mfa_enabled,
            role_ids=user.role_ids,
            assigned_module_keys=list(user.assigned_module_keys),
            admin_module_keys=list(user.admin_module_keys),
        )

    def effective_modules_for_user(self, user: UserEntity) -> list[str]:
        return effective_module_keys(user.user_type, user.assigned_module_keys)

    def effective_admin_modules_for_user(self, user: UserEntity) -> list[str]:
        return effective_admin_module_keys(user.user_type, user.admin_module_keys)

    def get_user_modules(self, tenant_id: UUID, user_id: UUID) -> tuple[UserEntity, list[str], list[str], list[str]]:
        user = self.get_user(tenant_id, user_id)
        assigned = list(user.assigned_module_keys)
        admin_keys = list(user.admin_module_keys)
        effective = self.effective_modules_for_user(user)
        return user, assigned, admin_keys, effective

    def set_user_modules(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        module_keys: list[str],
        updated_by: UUID | None,
    ) -> UserEntity:
        user = self.get_user(tenant_id, user_id)
        normalized = sorted({k.strip() for k in module_keys if k and k.strip()})
        invalid = [k for k in normalized if k not in ERP_MODULE_KEY_SET]
        if invalid:
            raise AppException(f"Unknown module keys: {', '.join(invalid)}")
        self._modules.replace_admin_keys(
            tenant_id=tenant_id,
            user_id=user_id,
            module_keys=normalized,
            assigned_by=updated_by,
        )
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="sec_user_module",
            entity_id=user_id,
            operation="update",
            performed_by=updated_by,
            new_value={"admin_module_keys": normalized},
        )
        return self.get_user(tenant_id, user_id)

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
        user = self._repo.update(tenant_id, user_id, **fields)
        if user is None:
            raise NotFoundException("User not found")
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

    def revoke_all_sessions(
        self, tenant_id: UUID, user_id: UUID, revoked_by: UUID | None = None
    ) -> None:
        self._sessions.revoke_all_for_user(tenant_id, user_id, revoked_by=revoked_by)
        self._audit.log_security_event(
            tenant_id=tenant_id,
            event_type="auth.sessions_revoked",
            user_id=user_id,
        )
