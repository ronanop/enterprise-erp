"""Persistence for CRM tenant settings overlay."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models.tenant_settings import CrmTenantSettings
from modules.crm.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext


class TenantSettingsRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_for_tenant(self, tenant_id: UUID) -> CrmTenantSettings | None:
        stmt = select(CrmTenantSettings).where(
            CrmTenantSettings.tenant_id == tenant_id,
            CrmTenantSettings.is_deleted.is_(False),
        )
        return self._db.scalars(stmt).first()

    def upsert(
        self,
        ctx: TenantContext,
        *,
        config: dict,
        config_version: int | None = None,
    ) -> CrmTenantSettings:
        row = self.get_for_tenant(ctx.tenant_id)
        now = utcnow()
        if row is None:
            row = CrmTenantSettings(
                tenant_id=ctx.tenant_id,
                config=config,
                config_version=config_version or 1,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(row)
        else:
            row.config = config
            if config_version is not None:
                row.config_version = config_version
            else:
                row.config_version = int(row.config_version or 1) + 1
            row.updated_by = ctx.user_id
            row.updated_at = now
            row.version = int(row.version or 1) + 1
        self._db.flush()
        return row

    def soft_reset(self, ctx: TenantContext) -> None:
        row = self.get_for_tenant(ctx.tenant_id)
        if row is None:
            return
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()
        self._db.flush()
