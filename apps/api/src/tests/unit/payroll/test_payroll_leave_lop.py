from datetime import date
from decimal import Decimal
from uuid import uuid4

from modules.payroll.domain.payroll_day_ledger import (
    LeaveDayMarker,
    expand_leave_markers,
    resolve_lop_on_scheduled_days,
)


def test_expand_leave_paid_wins_on_overlap():
    eid = uuid4()
    leaves = [
        {
            "start_date": date(2026, 2, 10),
            "end_date": date(2026, 2, 10),
            "is_paid": False,
            "leave_type_id": eid,
        },
        {
            "start_date": date(2026, 2, 10),
            "end_date": date(2026, 2, 10),
            "is_paid": True,
            "leave_type_id": eid,
        },
    ]
    markers = expand_leave_markers(leaves, date(2026, 2, 1), date(2026, 2, 28))
    assert markers[date(2026, 2, 10)].is_paid is True


def test_unpaid_leave_adds_lop_on_scheduled_day():
    d = date(2026, 2, 12)
    lop, paid_lv, unpaid_lv = resolve_lop_on_scheduled_days(
        [d],
        {},
        {d: LeaveDayMarker(is_paid=False)},
        lop_statuses={"absent"},
        half_lop_statuses={"half_day"},
        paid_attendance_statuses={"present"},
    )
    assert lop == Decimal("1")
    assert unpaid_lv == Decimal("1")
    assert paid_lv == Decimal("0")


def test_paid_leave_overrides_absent_attendance():
    d = date(2026, 2, 12)
    lop, paid_lv, unpaid_lv = resolve_lop_on_scheduled_days(
        [d],
        {d: "absent"},
        {d: LeaveDayMarker(is_paid=True)},
        lop_statuses={"absent"},
        half_lop_statuses={"half_day"},
        paid_attendance_statuses={"present"},
    )
    assert lop == Decimal("0")
    assert paid_lv == Decimal("1")


def test_half_day_paid_leave_uses_half_unit():
    d = date(2026, 2, 12)
    markers = expand_leave_markers(
        [
            {
                "start_date": d,
                "end_date": d,
                "is_paid": True,
                "days_count": Decimal("0.5"),
            }
        ],
        date(2026, 2, 1),
        date(2026, 2, 28),
    )
    assert markers[d].paid_units == Decimal("0.5")
    lop, paid_lv, unpaid_lv = resolve_lop_on_scheduled_days(
        [d],
        {d: "half_day"},
        markers,
        lop_statuses={"absent"},
        half_lop_statuses={"half_day"},
        paid_attendance_statuses={"present"},
    )
    assert lop == Decimal("0")
    assert paid_lv == Decimal("0.5")
    assert unpaid_lv == Decimal("0")


def test_missing_punch_on_scheduled_day_is_lop():
    d = date(2026, 2, 12)
    lop, paid_lv, unpaid_lv = resolve_lop_on_scheduled_days(
        [d],
        {},
        {},
        lop_statuses={"absent"},
        half_lop_statuses={"half_day"},
        paid_attendance_statuses={"present"},
    )
    assert lop == Decimal("1")
    assert paid_lv == Decimal("0")
    assert unpaid_lv == Decimal("0")
