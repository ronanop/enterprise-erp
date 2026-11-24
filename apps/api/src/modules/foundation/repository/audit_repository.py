"""Audit repository."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.entities import AuditLogEntity
from modules.foundation.models.audit import AuditEvent, AuditLog
from modules.foundation.models.security import SecUser
from modules.foundation.repository.base import utcnow


def _json_safe(value: object) -> object:
    """Coerce values so JSONB columns never see raw UUID/date/Decimal."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _safe_user_fk(self, user_id: UUID | None) -> UUID | None:
        """audit_* tables FK to sec_user — drop unknown / system placeholder ids."""
        if user_id is None:
            return None
        row = self.db.get(SecUser, user_id)
        if row is None or getattr(row, "is_deleted", False):
            return None
        return user_id

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
        safe_old = _json_safe(old_value) if old_value is not None else None
        safe_new = _json_safe(new_value) if new_value is not None else None
        if safe_old is not None and not isinstance(safe_old, dict):
            safe_old = {"value": safe_old}
        if safe_new is not None and not isinstance(safe_new, dict):
            safe_new = {"value": safe_new}
        row = AuditLog(
            id=uuid4(),
            tenant_id=tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation=operation,
            old_value=safe_old,
            new_value=safe_new,
            performed_by=self._safe_user_fk(performed_by),
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
        safe_details = _json_safe(details_json) if details_json is not None else None
        if safe_details is not None and not isinstance(safe_details, dict):
            safe_details = {"value": safe_details}
        row = AuditEvent(
            id=uuid4(),
            tenant_id=tenant_id,
            event_type=event_type,
            severity=severity,
            user_id=self._safe_user_fk(user_id),
            details_json=safe_details,
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

    def list_logs_for_entity(
        self,
        *,
        tenant_id: UUID | None,
        entity_name: str,
        entity_id: UUID,
    ) -> list[AuditLogEntity]:
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.entity_name == entity_name,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.performed_at.asc())
        )
        if tenant_id is not None:
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

    def list_logs_for_entity_ids(
        self,
        tenant_id: UUID,
        entity_ids: list[UUID],
    ) -> list[AuditLogEntity]:
        if not entity_ids:
            return []
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.tenant_id == tenant_id,
                AuditLog.entity_id.in_(entity_ids),
            )
            .order_by(AuditLog.performed_at)
        )
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
