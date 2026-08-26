"""User module assignment repository."""

from uuid import UUID, uuid4

from sqlalchemy import delete, select

from modules.foundation.domain.erp_modules import MODULE_ROLE_ADMIN, MODULE_ROLE_MEMBER
from modules.foundation.models.security import SecUserModule
from modules.foundation.repository.base import TenantScopedRepository, utcnow


class UserModuleRepository(TenantScopedRepository):
    def list_for_user(self, tenant_id: UUID, user_id: UUID) -> list[str]:
        stmt = (
            select(SecUserModule.module_key)
            .where(
                SecUserModule.tenant_id == tenant_id,
                SecUserModule.user_id == user_id,
            )
            .order_by(SecUserModule.module_key)
        )
        return list(self.db.scalars(stmt).all())

    def list_admin_keys_for_user(self, tenant_id: UUID, user_id: UUID) -> list[str]:
        stmt = (
            select(SecUserModule.module_key)
            .where(
                SecUserModule.tenant_id == tenant_id,
                SecUserModule.user_id == user_id,
                SecUserModule.role == MODULE_ROLE_ADMIN,
            )
            .order_by(SecUserModule.module_key)
        )
        return list(self.db.scalars(stmt).all())

    def list_grouped_by_user(self, tenant_id: UUID) -> dict[UUID, list[str]]:
        stmt = select(SecUserModule.user_id, SecUserModule.module_key).where(
            SecUserModule.tenant_id == tenant_id,
        )
        grouped: dict[UUID, list[str]] = {}
        for user_id, module_key in self.db.execute(stmt).all():
            grouped.setdefault(user_id, []).append(module_key)
        for keys in grouped.values():
            keys.sort()
        return grouped

    def get_assignment(
        self, tenant_id: UUID, user_id: UUID, module_key: str
    ) -> SecUserModule | None:
        stmt = select(SecUserModule).where(
            SecUserModule.tenant_id == tenant_id,
            SecUserModule.user_id == user_id,
            SecUserModule.module_key == module_key,
        )
        return self.db.scalar(stmt)

    def is_module_admin(self, tenant_id: UUID, user_id: UUID, module_key: str) -> bool:
        stmt = select(SecUserModule.id).where(
            SecUserModule.tenant_id == tenant_id,
            SecUserModule.user_id == user_id,
            SecUserModule.module_key == module_key,
            SecUserModule.role == MODULE_ROLE_ADMIN,
        )
        return self.db.scalar(stmt) is not None

    def list_user_ids_for_module(self, tenant_id: UUID, module_key: str) -> set[UUID]:
        stmt = select(SecUserModule.user_id).where(
            SecUserModule.tenant_id == tenant_id,
            SecUserModule.module_key == module_key,
        )
        return set(self.db.scalars(stmt).all())

    def list_rows_for_module(self, tenant_id: UUID, module_key: str) -> list[SecUserModule]:
        stmt = (
            select(SecUserModule)
            .where(
                SecUserModule.tenant_id == tenant_id,
                SecUserModule.module_key == module_key,
            )
            .order_by(SecUserModule.assigned_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def list_admin_user_ids_for_module(self, tenant_id: UUID, module_key: str) -> set[UUID]:
        stmt = select(SecUserModule.user_id).where(
            SecUserModule.tenant_id == tenant_id,
            SecUserModule.module_key == module_key,
            SecUserModule.role == MODULE_ROLE_ADMIN,
        )
        return set(self.db.scalars(stmt).all())

    def replace_admin_keys(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        module_keys: list[str],
        assigned_by: UUID | None,
    ) -> None:
        """Set admin-of modules without deleting member-only assignments."""
        rows = list(
            self.db.scalars(
                select(SecUserModule).where(
                    SecUserModule.tenant_id == tenant_id,
                    SecUserModule.user_id == user_id,
                )
            ).all()
        )
        wanted = set(module_keys)
        now = utcnow()
        by_key = {row.module_key: row for row in rows}

        for key, row in list(by_key.items()):
            if row.role == MODULE_ROLE_ADMIN and key not in wanted:
                self.db.delete(row)
                by_key.pop(key, None)

        for key in wanted:
            existing = by_key.get(key)
            if existing is None:
                self.db.add(
                    SecUserModule(
                        id=uuid4(),
                        tenant_id=tenant_id,
                        user_id=user_id,
                        module_key=key,
                        role=MODULE_ROLE_ADMIN,
                        assigned_at=now,
                        assigned_by=assigned_by,
                    )
                )
            elif existing.role != MODULE_ROLE_ADMIN:
                existing.role = MODULE_ROLE_ADMIN
                existing.assigned_at = now
                existing.assigned_by = assigned_by

        self.db.flush()

    def add_member(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        module_key: str,
        assigned_by: UUID | None,
    ) -> SecUserModule:
        row = SecUserModule(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            module_key=module_key,
            role=MODULE_ROLE_MEMBER,
            assigned_at=utcnow(),
            assigned_by=assigned_by,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def delete_assignment(self, row: SecUserModule) -> None:
        self.db.delete(row)
        self.db.flush()

    def replace_for_user(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        module_keys: list[str],
        assigned_by: UUID | None,
    ) -> None:
        self.db.execute(
            delete(SecUserModule).where(
                SecUserModule.tenant_id == tenant_id,
                SecUserModule.user_id == user_id,
            )
        )
        now = utcnow()
        for key in module_keys:
            self.db.add(
                SecUserModule(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    user_id=user_id,
                    module_key=key,
                    role=MODULE_ROLE_ADMIN,
                    assigned_at=now,
                    assigned_by=assigned_by,
                )
            )
        self.db.flush()
