"""User module assignment repository."""

from uuid import UUID, uuid4

from sqlalchemy import delete, select

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
                    assigned_at=now,
                    assigned_by=assigned_by,
                )
            )
        self.db.flush()
