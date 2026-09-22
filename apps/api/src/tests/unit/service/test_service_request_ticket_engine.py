"""Unit tests for service request ticket status engine."""

from types import SimpleNamespace

import pytest

from modules.service.domain.exceptions import InvalidServiceRequestState
from modules.service.service.engines.service_request_ticket_engine import (
    ServiceRequestTicketEngine,
)


@pytest.fixture
def engine() -> ServiceRequestTicketEngine:
    return ServiceRequestTicketEngine()


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("ticket_registered", "assigned"),
        ("assigned", "engineer_working"),
        ("engineer_working", "resolved"),
        ("resolved", "closed"),
        ("closed", "engineer_working"),
        ("pending_customer", "engineer_working"),
        ("pending_oem", "resolved"),
        ("awaiting_assignment", "assigned"),
    ],
)
def test_allowed_transitions(engine: ServiceRequestTicketEngine, current: str, target: str):
    row = SimpleNamespace(status=current)
    engine.transition(row, target)
    assert row.status == target


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("closed", "resolved"),
        ("cancelled", "assigned"),
        ("resolved", "assigned"),
        ("engineer_working", "closed"),
        ("draft", "resolved"),
    ],
)
def test_disallowed_transitions(engine: ServiceRequestTicketEngine, current: str, target: str):
    row = SimpleNamespace(status=current)
    with pytest.raises(InvalidServiceRequestState):
        engine.transition(row, target)
    assert row.status == current


def test_noop_same_status_allowed(engine: ServiceRequestTicketEngine):
    row = SimpleNamespace(status="engineer_working")
    engine.transition(row, "engineer_working")
    assert row.status == "engineer_working"


def test_engineer_end_path_resolve_then_close(engine: ServiceRequestTicketEngine):
    """Matches resolve_ticket: engineer_working -> resolved -> closed."""
    row = SimpleNamespace(status="engineer_working")
    engine.transition(row, "resolved")
    engine.transition(row, "closed")
    assert row.status == "closed"
