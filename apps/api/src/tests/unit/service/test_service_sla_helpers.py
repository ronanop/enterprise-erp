"""Unit tests for SLA helper logic on service request tickets."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from modules.service.service.service_request_ticket_service import ServiceRequestTicketService


def test_closed_within_sla_true():
    due = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
    ended = due - timedelta(minutes=5)
    assert ServiceRequestTicketService._closed_within_sla(due, ended) is True


def test_closed_within_sla_false_after_due():
    due = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)
    ended = due + timedelta(minutes=1)
    assert ServiceRequestTicketService._closed_within_sla(due, ended) is False


def test_closed_within_sla_missing_dates():
    assert ServiceRequestTicketService._closed_within_sla(None, datetime.now(timezone.utc)) is None
    assert ServiceRequestTicketService._closed_within_sla(datetime.now(timezone.utc), None) is None


def test_closed_within_sla_naive_datetimes_treated_as_utc():
    due = datetime(2026, 9, 1, 12, 0)  # naive
    ended = datetime(2026, 9, 1, 11, 59)
    assert ServiceRequestTicketService._closed_within_sla(due, ended) is True


def test_active_breached_by_status_flag():
    now = datetime(2026, 9, 3, 10, 0, tzinfo=timezone.utc)
    row = SimpleNamespace(sla_status="breached", due_at=now + timedelta(hours=1))
    assert ServiceRequestTicketService._is_active_breached(row, now=now) is True


def test_active_breached_by_past_due():
    now = datetime(2026, 9, 3, 10, 0, tzinfo=timezone.utc)
    row = SimpleNamespace(sla_status="within_sla", due_at=now - timedelta(minutes=1))
    assert ServiceRequestTicketService._is_active_breached(row, now=now) is True


def test_active_not_breached_before_due():
    now = datetime(2026, 9, 3, 10, 0, tzinfo=timezone.utc)
    row = SimpleNamespace(sla_status="within_sla", due_at=now + timedelta(minutes=30))
    assert ServiceRequestTicketService._is_active_breached(row, now=now) is False


def test_active_not_breached_without_due():
    now = datetime(2026, 9, 3, 10, 0, tzinfo=timezone.utc)
    row = SimpleNamespace(sla_status="within_sla", due_at=None)
    assert ServiceRequestTicketService._is_active_breached(row, now=now) is False
