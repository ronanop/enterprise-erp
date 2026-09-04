"""Audit event name constants (CR-004 Phase 2B-1)."""

from modules.asset.domain.operational_status_audit_events import OperationalStatusAuditEvent


def test_audit_event_names() -> None:
    assert OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED == "OperationalStatusChanged"
    assert OperationalStatusAuditEvent.ASSIGNMENT_RETURNED == "AssignmentReturned"
    assert OperationalStatusAuditEvent.RETIRED == "Retired"
    assert OperationalStatusAuditEvent.DISPOSED == "Disposed"
