"""Repository for HR integration API keys."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from modules.hr.models.integration_api_key import HrIntegrationApiKey

_ENSURE_SQL = """
CREATE TABLE IF NOT EXISTS hr.hr_integration_api_key (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES foundation.sec_tenant(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    company_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    last_used_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uk_hr_integration_api_key_prefix UNIQUE (tenant_id, key_prefix)
);
ALTER TABLE hr.hr_integration_api_key
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS ix_hr_integration_api_key_tenant
    ON hr.hr_integration_api_key (tenant_id);
CREATE INDEX IF NOT EXISTS ix_hr_integration_api_key_prefix
    ON hr.hr_integration_api_key (key_prefix);
"""


def _table_missing(exc: ProgrammingError) -> bool:
    text_ = str(exc.orig if getattr(exc, "orig", None) is not None else exc).lower()
    return "hr_integration_api_key" in text_ and "does not exist" in text_


class HrIntegrationApiKeyRepository:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._ensured = False

    def ensure_table(self) -> None:
        if self._ensured:
            return
        self._db.execute(text(_ENSURE_SQL))
        self._db.commit()
        self._ensured = True

    def list_active(self, tenant_id: UUID) -> list[HrIntegrationApiKey]:
        self.ensure_table()
        try:
            return list(
                self._db.scalars(
                    select(HrIntegrationApiKey)
                    .where(
                        HrIntegrationApiKey.tenant_id == tenant_id,
                        HrIntegrationApiKey.is_deleted.is_(False),
                    )
                    .order_by(HrIntegrationApiKey.created_at.desc())
                ).all()
            )
        except ProgrammingError as exc:
            if _table_missing(exc):
                self._db.rollback()
                self._ensured = False
                self.ensure_table()
                return []
            raise

    def get(self, tenant_id: UUID, key_id: UUID) -> HrIntegrationApiKey | None:
        self.ensure_table()
        return self._db.scalar(
            select(HrIntegrationApiKey).where(
                HrIntegrationApiKey.tenant_id == tenant_id,
                HrIntegrationApiKey.id == key_id,
                HrIntegrationApiKey.is_deleted.is_(False),
            )
        )

    def find_by_prefix(self, key_prefix: str) -> HrIntegrationApiKey | None:
        self.ensure_table()
        return self._db.scalar(
            select(HrIntegrationApiKey).where(
                HrIntegrationApiKey.key_prefix == key_prefix,
                HrIntegrationApiKey.is_deleted.is_(False),
                HrIntegrationApiKey.status == "active",
            )
        )

    def create(
        self,
        *,
        tenant_id: UUID,
        name: str,
        key_prefix: str,
        key_hash: str,
        endpoints: list[str],
        fields: list[str],
        company_ids: list[str],
        notes: str | None,
        expires_at: datetime | None,
        actor_id: UUID | None,
    ) -> HrIntegrationApiKey:
        self.ensure_table()
        now = datetime.now(timezone.utc)
        row = HrIntegrationApiKey(
            id=uuid4(),
            tenant_id=tenant_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            endpoints=endpoints,
            fields=fields,
            company_ids=company_ids,
            status="active",
            notes=notes,
            expires_at=expires_at,
            created_by=actor_id,
            updated_by=actor_id,
            created_at=now,
            updated_at=now,
            version=1,
        )
        self._db.add(row)
        self._db.flush()
        return row

    def revoke(self, row: HrIntegrationApiKey, actor_id: UUID | None) -> None:
        now = datetime.now(timezone.utc)
        row.status = "revoked"
        row.is_deleted = True
        row.deleted_at = now
        row.deleted_by = actor_id
        row.updated_at = now
        row.updated_by = actor_id
        row.version = int(row.version or 1) + 1
        self._db.flush()

    def touch_last_used(self, row: HrIntegrationApiKey) -> None:
        row.last_used_at = datetime.now(timezone.utc)
        self._db.flush()
