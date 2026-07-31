"""RBAC permission evaluation."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.models.security import SecPermission, SecRolePermission, SecUserRole


class RBACEngine:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user_permission_codes(self, user_id: UUID, tenant_id: UUID) -> set[str]:
        rows = (
            self._db.query(SecPermission.permission_code)
            .join(SecRolePermission, SecRolePermission.permission_id == SecPermission.id)
            .join(SecUserRole, SecUserRole.role_id == SecRolePermission.role_id)
            .filter(
                SecUserRole.user_id == user_id,
                SecUserRole.tenant_id == tenant_id,
                SecPermission.is_active.is_(True),
            )
            .distinct()
            .all()
        )
        return {row[0] for row in rows}

    def list_user_ids_with_permission(self, tenant_id: UUID, permission_code: str) -> list[UUID]:
        rows = (
            self._db.query(SecUserRole.user_id)
            .join(SecRolePermission, SecRolePermission.role_id == SecUserRole.role_id)
            .join(SecPermission, SecPermission.id == SecRolePermission.permission_id)
            .filter(
                SecUserRole.tenant_id == tenant_id,
                SecPermission.permission_code == permission_code,
                SecPermission.is_active.is_(True),
            )
            .distinct()
            .all()
        )
        return [row[0] for row in rows]

    def has_permission(self, user_id: UUID, tenant_id: UUID, permission_code: str) -> bool:
        return permission_code in self.get_user_permission_codes(user_id, tenant_id)
