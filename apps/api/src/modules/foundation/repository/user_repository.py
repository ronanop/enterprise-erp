"""User repository."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.entities import UserEntity
from modules.foundation.models.security import SecUser, SecUserRole
from modules.foundation.repository.base import TenantScopedRepository, utcnow


class UserRepository(TenantScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_by_id(self, tenant_id: UUID, user_id: UUID) -> UserEntity | None:
        stmt = (
            select(SecUser)
            .options(selectinload(SecUser.user_roles))
            .where(
                SecUser.id == user_id,
                SecUser.tenant_id == tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_email(self, tenant_id: UUID, email: str) -> SecUser | None:
        stmt = select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.email == email.lower(),
            SecUser.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_active_by_email(self, email: str) -> SecUser | None:
        """Resolve a user by email for login (emails are unique per organization)."""
        stmt = select(SecUser).where(
            SecUser.email == email.lower(),
            SecUser.is_deleted.is_(False),
        )
        return self.db.scalars(stmt).first()

    def list_users(self, tenant_id: UUID) -> list[UserEntity]:
        stmt = (
            select(SecUser)
            .options(selectinload(SecUser.user_roles))
            .where(SecUser.tenant_id == tenant_id, SecUser.is_deleted.is_(False))
        )
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def create(
        self,
        *,
        tenant_id: UUID,
        email: str,
        password_hash: str,
        display_name: str,
        user_type: str,
        created_by: UUID | None = None,
    ) -> UserEntity:
        row = SecUser(
            id=uuid4(),
            tenant_id=tenant_id,
            email=email.lower(),
            password_hash=password_hash,
            display_name=display_name,
            user_type=user_type,
            status="active",
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(self, tenant_id: UUID, user_id: UUID, **fields: object) -> UserEntity | None:
        stmt = select(SecUser).where(
            SecUser.id == user_id,
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            if key == "email" and value:
                setattr(row, key, str(value).lower())
            elif hasattr(row, key) and value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        self.db.flush()
        return self._to_entity(row)

    def soft_delete(self, tenant_id: UUID, user_id: UUID, deleted_by: UUID | None = None) -> bool:
        stmt = select(SecUser).where(SecUser.id == user_id, SecUser.tenant_id == tenant_id)
        row = self.db.scalar(stmt)
        if row is None or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = deleted_by
        self.db.flush()
        return True

    def record_failed_login(self, user: SecUser) -> None:
        user.failed_login_count += 1
        self.db.flush()

    def record_successful_login(self, user: SecUser) -> None:
        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = utcnow()
        self.db.flush()

    def lock_account(self, user: SecUser, until: datetime) -> None:
        user.locked_until = until
        user.status = "locked"
        self.db.flush()

    def assign_role(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        role_id: UUID,
        assigned_by: UUID | None,
    ) -> None:
        link = SecUserRole(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            role_id=role_id,
            assigned_at=utcnow(),
            assigned_by=assigned_by,
        )
        self.db.add(link)
        self.db.flush()

    @staticmethod
    def _to_entity(row: SecUser) -> UserEntity:
        return UserEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            email=row.email,
            display_name=row.display_name,
            user_type=row.user_type,
            status=row.status,
            mfa_enabled=row.mfa_enabled,
            version=row.version,
            is_deleted=row.is_deleted,
            last_login_at=row.last_login_at,
            failed_login_count=row.failed_login_count,
            locked_until=row.locked_until,
            role_ids=[ur.role_id for ur in row.user_roles],
        )
