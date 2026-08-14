"""Audit repository."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.entities import AuditLogEntity
from modules.foundation.models.audit import AuditEvent, AuditLog
from modules.foundation.repository.base import utcnow


def _json_safe(value: object) -> object:
    """Coerce values so JSONB dumps never receive raw UUID/datetime objects."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_log(
        self,
        *,
        tenant_id: UUID | None,
        entity_name: str,
        entity_id: UUID,
        operation: str,
        performed_by: UUID | None,
        old_value: dict | None = None,
        new_value: dict | None = None,
        ip_address: str | None = None,
        request_id: str | None = None,
    ) -> AuditLogEntity:
        row = AuditLog(
            id=uuid4(),
            tenant_id=tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation=operation,
            old_value=_json_safe(old_value) if old_value is not None else None,
            new_value=_json_safe(new_value) if new_value is not None else None,
            performed_by=performed_by,
            performed_at=utcnow(),
            ip_address=ip_address,
            request_id=request_id,
        )
        self.db.add(row)
        self.db.flush()
        return AuditLogEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            entity_name=row.entity_name,
            entity_id=row.entity_id,
            operation=row.operation,
            performed_at=row.performed_at,
            performed_by=row.performed_by,
            old_value=row.old_value,
            new_value=row.new_value,
        )

    def create_event(
        self,
        *,
        tenant_id: UUID | None,
        event_type: str,
        user_id: UUID | None,
        severity: str = "info",
        details_json: dict | None = None,
        ip_address: str | None = None,
    ) -> None:
        row = AuditEvent(
            id=uuid4(),
            tenant_id=tenant_id,
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            details_json=_json_safe(details_json) if details_json is not None else None,
            performed_at=utcnow(),
            ip_address=ip_address,
        )
        self.db.add(row)
        self.db.flush()

    def list_logs(self, tenant_id: UUID | None = None) -> list[AuditLogEntity]:
        stmt = select(AuditLog).order_by(AuditLog.performed_at.desc())
        if tenant_id:
            stmt = stmt.where(AuditLog.tenant_id == tenant_id)
        return [
            AuditLogEntity(
                id=r.id,
                tenant_id=r.tenant_id,
                entity_name=r.entity_name,
                entity_id=r.entity_id,
                operation=r.operation,
                performed_at=r.performed_at,
                performed_by=r.performed_by,
                old_value=r.old_value,
                new_value=r.new_value,
            )
            for r in self.db.scalars(stmt).all()
        ]

    def get_log(self, log_id: UUID) -> AuditLogEntity | None:
        row = self.db.get(AuditLog, log_id)
        if row is None:
            return None
        return AuditLogEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            entity_name=row.entity_name,
            entity_id=row.entity_id,
            operation=row.operation,
            performed_at=row.performed_at,
            performed_by=row.performed_by,
            old_value=row.old_value,
            new_value=row.new_value,
        )

    def list_events(self, tenant_id: UUID | None = None) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(AuditEvent.performed_at.desc())
        if tenant_id:
            stmt = stmt.where(AuditEvent.tenant_id == tenant_id)
        return list(self.db.scalars(stmt).all())
