"""User service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.rbac_service import RBACService
from security.password import PasswordHasher


class UserService:
    def __init__(self, db: Session) -> None:
        self._repo = UserRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)
        self._rbac = RBACService(db)

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

    def revoke_role(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        role_id: UUID,
        revoked_by: UUID | None,
    ) -> None:
        if self._repo.revoke_role(user_id=user_id, role_id=role_id):
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
        from core.redis import SessionStore

        session_ids = self._sessions.revoke_all_for_user(tenant_id, user_id, revoked_by=revoked_by)
        self._sessions.revoke_refresh_tokens_for_user(tenant_id, user_id)
        store = SessionStore()
        for session_id in session_ids:
            store.delete_session(session_id)
        self._rbac.invalidate_user(user_id)
        self._audit.log_security_event(
            tenant_id=tenant_id,
            event_type="auth.sessions_revoked",
            user_id=user_id,
        )
