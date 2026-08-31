from datetime import date
from decimal import Decimal

import pytest

from modules.hr.domain.exceptions import InvalidLeaveRequestState
from modules.hr.domain.leave_cycle_rules import (
    assert_no_future_calendar_month_leave,
    calendar_months_in_range,
    first_day_of_next_month,
    months_waiting_on_unposted_credit,
    validate_leave_cycle_application,
)


def test_calendar_months_span():
    assert calendar_months_in_range(date(2026, 8, 28), date(2026, 9, 2)) == [
        "2026-08",
        "2026-09",
    ]


def test_first_day_of_next_month():
    assert first_day_of_next_month("2026-08") == date(2026, 9, 1)
    assert first_day_of_next_month("2026-12") == date(2027, 1, 1)


def test_blocks_future_calendar_month():
    with pytest.raises(InvalidLeaveRequestState, match="future calendar month"):
        assert_no_future_calendar_month_leave(
            date(2026, 9, 1),
            date(2026, 9, 3),
            today=date(2026, 8, 25),
        )


def test_allows_current_and_past_month_including_21_31():
    assert_no_future_calendar_month_leave(
        date(2026, 8, 21),
        date(2026, 8, 31),
        today=date(2026, 8, 25),
    )
    # Retrospective after credit month starts
    assert_no_future_calendar_month_leave(
        date(2026, 8, 25),
        date(2026, 8, 25),
        today=date(2026, 9, 3),
    )


def test_waiting_credit_while_inside_leave_month():
    waiting = months_waiting_on_unposted_credit(
        ["2026-08"],
        last_accrual_yyyymm="2026-07",
        today=date(2026, 8, 25),
    )
    assert waiting == ["2026-08"]


def test_not_waiting_after_accrual_posted():
    waiting = months_waiting_on_unposted_credit(
        ["2026-08"],
        last_accrual_yyyymm="2026-08",
        today=date(2026, 9, 3),
    )
    assert waiting == []


def test_insufficient_explains_unposted_august_credit():
    with pytest.raises(InvalidLeaveRequestState, match="2026-09-01"):
        validate_leave_cycle_application(
            start_date=date(2026, 8, 25),
            end_date=date(2026, 8, 25),
            days_count=1,
            closing_balance=Decimal("0"),
            last_accrual_yyyymm="2026-07",
            monthly_credit_days=Decimal("1.5"),
            today=date(2026, 8, 25),
        )


def test_after_credit_past_leave_allowed_when_balance_enough():
    validate_leave_cycle_application(
        start_date=date(2026, 8, 25),
        end_date=date(2026, 8, 25),
        days_count=1,
        closing_balance=Decimal("1.5"),
        last_accrual_yyyymm="2026-08",
        monthly_credit_days=Decimal("1.5"),
        today=date(2026, 9, 3),
    )
