"""Central audit service (DG-06)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.repository.audit_repository import AuditRepository


class AuditService:
    def __init__(self, db: Session) -> None:
        self._repo = AuditRepository(db)

    def log_entity_change(
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
    ):
        return self._repo.create_log(
            tenant_id=tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation=operation,
            performed_by=performed_by,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            request_id=request_id,
        )

    def log_security_event(
        self,
        *,
        tenant_id: UUID | None,
        event_type: str,
        user_id: UUID | None,
        severity: str = "info",
        details_json: dict | None = None,
        ip_address: str | None = None,
    ) -> None:
        self._repo.create_event(
            tenant_id=tenant_id,
            event_type=event_type,
            user_id=user_id,
            severity=severity,
            details_json=details_json,
            ip_address=ip_address,
        )

    def list_logs(self, tenant_id: UUID | None = None):
        return self._repo.list_logs(tenant_id=tenant_id)

    def get_log(self, log_id: UUID):
        return self._repo.get_log(log_id)

    def list_events(self, tenant_id: UUID | None = None):
        return self._repo.list_events(tenant_id=tenant_id)

    def list_logs_for_entity(
        self,
        *,
        tenant_id: UUID | None,
        entity_name: str,
        entity_id: UUID,
    ):
        return self._repo.list_logs_for_entity(
            tenant_id=tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
        )
