"""Unit tests for ticket access flags (no helpdesk can_end path)."""

from dataclasses import fields
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from modules.service.service.ticket_access_service import TicketAccess, TicketAccessLevel, TicketAccessService


def test_ticket_access_has_no_can_end_flag():
    names = {f.name for f in fields(TicketAccess)}
    assert "can_end" not in names
    assert "can_work" in names
    assert "can_resume" in names


def _build_service(*, is_manager: bool, employee_id=None) -> TicketAccessService:
    db = MagicMock()
    svc = TicketAccessService(db)
    svc.resolve_employee_id = MagicMock(return_value=employee_id)
    svc.is_manager = MagicMock(return_value=is_manager)
    svc.get_co_owner_ids = MagicMock(return_value=set())
    svc.is_stakeholder_email = MagicMock(return_value=False)
    svc.is_field_engineer_email = MagicMock(return_value=False)
    db.scalar.return_value = SimpleNamespace(email="user@example.com")
    return svc


def test_owner_can_work_when_opened():
    owner_id = uuid4()
    svc = _build_service(is_manager=False, employee_id=owner_id)
    row = SimpleNamespace(
        id=uuid4(),
        owner_employee_id=owner_id,
        status="engineer_working",
        opened_at="2026-09-01T00:00:00Z",
        ownership_locked=False,
    )
    access = svc.evaluate(SimpleNamespace(user_id=uuid4(), tenant_id=uuid4()), row)
    assert access.level == TicketAccessLevel.FULL
    assert access.is_owner is True
    assert access.can_work is True
    assert access.can_open is False


def test_manager_view_only_on_assigned_ticket():
    svc = _build_service(is_manager=True, employee_id=uuid4())
    row = SimpleNamespace(
        id=uuid4(),
        owner_employee_id=uuid4(),
        status="engineer_working",
        opened_at="2026-09-01T00:00:00Z",
        ownership_locked=False,
    )
    access = svc.evaluate(SimpleNamespace(user_id=uuid4(), tenant_id=uuid4()), row)
    assert access.level == TicketAccessLevel.VIEW_ONLY
    assert access.is_manager is True
    assert access.can_work is False
    assert access.can_assign is False


def test_manager_can_assign_unassigned_ticket():
    svc = _build_service(is_manager=True, employee_id=uuid4())
    row = SimpleNamespace(
        id=uuid4(),
        owner_employee_id=None,
        status="awaiting_assignment",
        opened_at=None,
        ownership_locked=False,
    )
    access = svc.evaluate(SimpleNamespace(user_id=uuid4(), tenant_id=uuid4()), row)
    assert access.level == TicketAccessLevel.ASSIGN_PREVIEW
    assert access.can_assign is True


def test_closed_ticket_locks_assignment():
    owner_id = uuid4()
    svc = _build_service(is_manager=True, employee_id=owner_id)
    row = SimpleNamespace(
        id=uuid4(),
        owner_employee_id=None,
        status="closed",
        opened_at=None,
        ownership_locked=False,
    )
    access = svc.evaluate(SimpleNamespace(user_id=uuid4(), tenant_id=uuid4()), row)
    assert access.can_assign is False
