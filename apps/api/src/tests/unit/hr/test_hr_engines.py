"""Unit tests for HR engines."""

from decimal import Decimal
from types import SimpleNamespace

from modules.hr.service.engines import (
    AttendanceEngine,
    EmploymentEngine,
    LeaveBalanceEngine,
    LeaveRequestEngine,
    SeparationEngine,
)


def test_leave_request_lifecycle():
    engine = LeaveRequestEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"


def test_employment_activate_and_end():
    engine = EmploymentEngine()
    row = SimpleNamespace(status="draft")
    engine.apply_activate(row)
    assert row.status == "active"
    engine.apply_end(row)
    assert row.status == "ended"


def test_separation_flow():
    engine = SeparationEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.manager_approve(row)
    engine.it_approve(row)
    engine.accounts_approve(row)
    engine.hr_approve(row)
    engine.complete(row)
    assert row.status == "completed"


def test_attendance_lock():
    engine = AttendanceEngine()
    row = SimpleNamespace(status="recorded")
    engine.lock(row)
    assert row.status == "locked"


def test_leave_balance_usage():
    engine = LeaveBalanceEngine()
    row = SimpleNamespace(status="open", opening_balance=Decimal("10"), accrued=Decimal("0"), used=Decimal("0"), closing_balance=Decimal("10"))
    engine.apply_usage(row, Decimal("2"))
    assert row.used == Decimal("2")
    assert row.closing_balance == Decimal("8")
