"""SOP workflow engine for service request tickets."""

from modules.service.domain.exceptions import InvalidServiceRequestState


class ServiceRequestTicketEngine:
    """Valid status transitions per SOP workflow."""

    TRANSITIONS: dict[str, set[str]] = {
        "draft": {"ticket_registered", "cancelled"},
        "ticket_registered": {"assigned", "cancelled"},
        "assigned": {"engineer_working", "pending_customer", "pending_oem", "cancelled"},
        "engineer_working": {"pending_customer", "pending_oem", "resolved", "cancelled"},
        "pending_customer": {"engineer_working", "pending_oem", "resolved", "cancelled"},
        "pending_oem": {"engineer_working", "pending_customer", "resolved", "cancelled"},
        "resolved": {"closed", "engineer_working"},
        "closed": {"engineer_working", "assigned"},
        "cancelled": set(),
        # legacy statuses
        "submitted": {"approved", "ticket_registered", "cancelled"},
        "approved": {"assigned", "ticket_registered", "cancelled"},
        "new": {"assigned", "ticket_registered", "cancelled"},
        "in_progress": {"engineer_working", "pending_customer", "pending_oem", "resolved", "cancelled"},
    }

    def transition(self, row, to_status: str) -> None:
        current = row.status
        allowed = self.TRANSITIONS.get(current, set())
        if to_status not in allowed and current != to_status:
            raise InvalidServiceRequestState(
                f"Cannot transition from '{current}' to '{to_status}'"
            )
        row.status = to_status
