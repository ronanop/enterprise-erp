"""Unit tests for surplus cash deployment suggestions."""

from datetime import date
from decimal import Decimal

from modules.finance.domain.treasury_suggestions import (
    MAX_SUGGESTIONS,
    EarlyPaymentOffer,
    WeeklyBalance,
    build_plan,
    deployable_surplus,
    simple_return,
)

CRORE = Decimal("10000000")
TODAY = date(2026, 9, 21)
BUFFER = Decimal("1000000")


def flat_weeks(balance: Decimal, count: int = 13) -> list[WeeklyBalance]:
    return [WeeklyBalance(week_number=i, closing_balance=balance) for i in range(1, count + 1)]


def test_only_the_trough_is_spare_not_todays_balance() -> None:
    """A 1 cr balance that dips to 30 lakh in week six has 20 lakh spare, not 90."""
    weeks = [
        WeeklyBalance(week_number=1, closing_balance=CRORE),
        WeeklyBalance(week_number=2, closing_balance=CRORE),
        WeeklyBalance(week_number=6, closing_balance=Decimal("3000000")),
        WeeklyBalance(week_number=7, closing_balance=CRORE),
    ]
    amount, days = deployable_surplus(
        weeks, opening_balance=CRORE, operating_buffer=BUFFER
    )

    assert amount == Decimal("2000000.00")
    # Holding back the trough amount keeps the buffer intact every week, so the
    # cash can stay locked for the whole window.
    assert days == 28


def test_no_surplus_when_the_trough_is_below_the_buffer() -> None:
    amount, days = deployable_surplus(
        flat_weeks(Decimal("500000")),
        opening_balance=Decimal("500000"),
        operating_buffer=BUFFER,
    )

    assert amount == Decimal("0.00")
    assert days == 0


def test_plan_warns_instead_of_investing_when_cash_goes_negative() -> None:
    weeks = flat_weeks(CRORE)
    weeks[5] = WeeklyBalance(week_number=6, closing_balance=Decimal("-2000000"))

    plan = build_plan(as_of=TODAY, opening_balance=CRORE, weekly_balances=weeks)

    assert plan.suggestions == []
    assert plan.deployable_amount == Decimal("0.00")
    assert "goes negative" in plan.warnings[0]


def test_plan_warns_when_nothing_is_spare() -> None:
    plan = build_plan(
        as_of=TODAY,
        opening_balance=Decimal("900000"),
        weekly_balances=flat_weeks(Decimal("900000")),
    )

    assert plan.suggestions == []
    assert "Nothing is spare" in plan.warnings[0]


def test_suggestions_are_ranked_by_rate_of_return() -> None:
    plan = build_plan(
        as_of=TODAY, opening_balance=CRORE * 5, weekly_balances=flat_weeks(CRORE * 5)
    )

    assert plan.suggestions
    rates = [s.annual_rate_pct for s in plan.suggestions]
    assert rates == sorted(rates, reverse=True)
    assert plan.suggestions[0].rank == 1
    assert len(plan.suggestions) <= MAX_SUGGESTIONS


def test_early_payment_discount_outranks_every_deposit() -> None:
    """2% for paying 60 days early beats any deposit rate on offer."""
    plan = build_plan(
        as_of=TODAY,
        opening_balance=CRORE * 5,
        weekly_balances=flat_weeks(CRORE * 5),
        early_payment_offers=[
            EarlyPaymentOffer(
                vendor_name="Ingram",
                reference="BILL-901",
                amount=CRORE,
                discount_pct=Decimal("2"),
                days_early=60,
            )
        ],
    )

    top = plan.suggestions[0]
    assert top.kind == "early_payment"
    # 2% of 1 cr = 2 lakh saved.
    assert top.expected_return == Decimal("200000.00")
    # 2% over 60 days annualises to about 12%.
    assert top.annual_rate_pct > Decimal("12")


def test_instruments_longer_than_the_window_are_not_offered() -> None:
    """Money needed in three weeks cannot go into a 90-day deposit."""
    weeks = [
        WeeklyBalance(week_number=1, closing_balance=CRORE),
        WeeklyBalance(week_number=2, closing_balance=CRORE),
        WeeklyBalance(week_number=3, closing_balance=Decimal("1000000")),
    ]
    plan = build_plan(as_of=TODAY, opening_balance=CRORE, weekly_balances=weeks)

    assert all(s.days <= plan.deployable_days for s in plan.suggestions)
    assert not any("91-180" in s.title for s in plan.suggestions)


def test_simple_return_is_pro_rated_over_the_year() -> None:
    # 1 cr at 7.3% for 365 days.
    assert simple_return(CRORE, Decimal("7.3"), 365) == Decimal("730000.00")
    assert simple_return(CRORE, Decimal("7.3"), 0) == Decimal("0.00")
    assert simple_return(Decimal("0"), Decimal("7.3"), 90) == Decimal("0.00")


def test_operating_buffer_is_always_held_back() -> None:
    plan = build_plan(
        as_of=TODAY,
        opening_balance=CRORE,
        weekly_balances=flat_weeks(CRORE),
        operating_buffer=Decimal("4000000"),
    )

    assert plan.deployable_amount == Decimal("6000000.00")
    assert all(s.amount <= Decimal("6000000.00") for s in plan.suggestions)
