"""Unit tests for SLA pause clock accounting."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from modules.service.service.service_request_ticket_service import ServiceRequestTicketService


def test_sla_clock_freezes_while_paused():
    now = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    started = now - timedelta(hours=2)
    paused_at = now - timedelta(minutes=30)
    row = SimpleNamespace(
        sla_started_at=started,
        sla_paused_at=paused_at,
        sla_paused_total_minutes=10,
        due_at=started + timedelta(hours=4),
        sla_status="within_sla",
    )
    clock = ServiceRequestTicketService._sla_clock(row, now=now)
    assert clock["is_paused"] is True
    # Wall to pause moment = 90 min; completed pauses = 10 → elapsed 80
    assert clock["elapsed_minutes"] == 80
    # Remaining freezes at pause: due - paused_at = 150 min
    assert clock["remaining_minutes"] == 150
    assert clock["is_breached"] is False


def test_sla_clock_running_without_pause():
    now = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    started = now - timedelta(minutes=45)
    row = SimpleNamespace(
        id=uuid4(),
        sla_started_at=started,
        sla_paused_at=None,
        sla_paused_total_minutes=0,
        due_at=started + timedelta(hours=2),
        sla_status="within_sla",
    )
    clock = ServiceRequestTicketService._sla_clock(row, now=now)
    assert clock["is_paused"] is False
    assert clock["elapsed_minutes"] == 45
    assert clock["remaining_minutes"] == 75
