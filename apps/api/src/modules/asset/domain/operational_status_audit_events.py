"""CR-004 audit event names (integration deferred)."""


class OperationalStatusAuditEvent:
    """Stable audit event identifiers for future Audit engine wiring."""

    OPERATIONAL_STATUS_CHANGED = "OperationalStatusChanged"
    ASSIGNMENT_RETURNED = "AssignmentReturned"
    RETIRED = "Retired"
    DISPOSED = "Disposed"


# Alias for documentation / CR-004 naming.
OperationalStatusAuditEvents = OperationalStatusAuditEvent
