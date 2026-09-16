"""Department module mapping repository."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.hierarchy import OrgDepartmentModule
from modules.organization.repository.base import utcnow


class DepartmentModuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_module_keys_by_department(
        self, tenant_id: UUID, department_ids: list[UUID]
    ) -> dict[UUID, list[str]]:
        if not department_ids:
            return {}
        rows = self.db.scalars(
            select(OrgDepartmentModule).where(
                OrgDepartmentModule.tenant_id == tenant_id,
                OrgDepartmentModule.department_id.in_(department_ids),
            )
        ).all()
        out: dict[UUID, list[str]] = {did: [] for did in department_ids}
        for row in rows:
            keys = out.setdefault(row.department_id, [])
            if row.module_key not in keys:
                keys.append(row.module_key)
        for did in out:
            out[did] = sorted(out[did])
        return out

    def replace_modules(
        self,
        ctx: TenantContext,
        *,
        department_id: UUID,
        module_keys: list[str],
    ) -> list[str]:
        unique: list[str] = []
        seen: set[str] = set()
        for key in module_keys:
            normalized = key.strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            unique.append(normalized)

        self.db.execute(
            delete(OrgDepartmentModule).where(
                OrgDepartmentModule.tenant_id == ctx.tenant_id,
                OrgDepartmentModule.department_id == department_id,
            )
        )
        now = utcnow()
        for module_key in unique:
            self.db.add(
                OrgDepartmentModule(
                    id=uuid4(),
                    tenant_id=ctx.tenant_id,
                    department_id=department_id,
                    module_key=module_key,
                    assigned_at=now,
                    assigned_by=ctx.user_id,
                )
            )
        self.db.flush()
        return unique
