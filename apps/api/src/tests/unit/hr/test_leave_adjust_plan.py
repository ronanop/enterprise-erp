"""Unit tests for leave-adjust auto planner."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from modules.hr.domain.leave_adjust_plan import (
    LeavePool,
    PlanDay,
    allocate_leave_days,
    canonical_leave_pool_code,
    leave_pool_rank,
)


def test_rank_order():
    assert leave_pool_rank("CL") == 0
    assert leave_pool_rank("sick") == 1
    assert leave_pool_rank("EL") == 2
    assert leave_pool_rank("CO") is None
    assert canonical_leave_pool_code("casual leave") == "CL"
    assert canonical_leave_pool_code("SICK") == "SL"


def test_allocate_cl_then_lop():
    cl_id = uuid4()
    days = [
        PlanDay(date(2026, 8, 21), "absent", "candidate", Decimal("1"), "lop"),
        PlanDay(date(2026, 8, 22), "absent", "candidate", Decimal("1"), "lop"),
        PlanDay(date(2026, 8, 24), "absent", "candidate", Decimal("1"), "lop"),
    ]
    pools = [LeavePool(cl_id, "CL", "Casual Leave", Decimal("2"))]
    planned, after, used, lop = allocate_leave_days(days, pools)
    assert used == Decimal("2")
    assert lop == Decimal("1")
    assert planned[0].proposed_result == "adjusted"
    assert planned[0].proposed_type_code == "CL"
    assert planned[1].proposed_result == "adjusted"
    assert planned[2].proposed_result == "lop"
    assert after[0].remaining == Decimal("0")


def test_half_day_uses_half_balance():
    cl_id = uuid4()
    days = [PlanDay(date(2026, 8, 21), "half_day", "candidate", Decimal("0.5"), "lop")]
    pools = [LeavePool(cl_id, "CL", "Casual Leave", Decimal("1"))]
    planned, after, used, lop = allocate_leave_days(days, pools)
    assert used == Decimal("0.5")
    assert lop == Decimal("0")
    assert after[0].remaining == Decimal("0.5")
    assert planned[0].proposed_result == "adjusted"
