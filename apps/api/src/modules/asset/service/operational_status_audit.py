"""Operational status audit recording (CR-004 Phase 2B-2)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from modules.asset.domain.operational_status_audit_events import OperationalStatusAuditEvent
from modules.asset.domain.workflow_codes import ENTITY_AST_ASSET
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_ACTION_AUDIT_EVENT: dict[str, str] = {
    "assign": OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
    "return_to_ready": OperationalStatusAuditEvent.ASSIGNMENT_RETURNED,
    "retire": OperationalStatusAuditEvent.RETIRED,
    "mark_pending_disposal": OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
    "start_disposal": OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
    "reinstate": OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
    "complete_disposal": OperationalStatusAuditEvent.DISPOSED,
    "initialize_ready_to_move": OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED,
}


def audit_event_for_action(action: str) -> str:
    return _ACTION_AUDIT_EVENT.get(action, OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED)


def log_operational_status_change(
    audit: AuditService,
    ctx: TenantContext,
    asset_id: UUID,
    *,
    old_status: str | None,
    new_status: str,
    action: str,
    reason: str | None = None,
    remarks: str | None = None,
    source_entity: str | None = None,
    source_entity_id: UUID | None = None,
) -> None:
    """Persist audit log after successful operational_status write."""
    timestamp = datetime.now(timezone.utc).isoformat()
    audit.log_entity_change(
        tenant_id=ctx.tenant_id,
        entity_name=ENTITY_AST_ASSET,
        entity_id=asset_id,
        operation=audit_event_for_action(action),
        performed_by=ctx.user_id,
        old_value={
            "operational_status": old_status,
            "action": action,
            "reason": reason,
            "remarks": remarks,
            "timestamp": timestamp,
            "source_entity": source_entity,
            "source_entity_id": str(source_entity_id) if source_entity_id else None,
        },
        new_value={
            "operational_status": new_status,
            "action": action,
            "reason": reason,
            "remarks": remarks,
            "timestamp": timestamp,
        },
    )
