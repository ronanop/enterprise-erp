"""Unit tests for the rolling cash flow forecast domain rules."""

from datetime import date, timedelta
from decimal import Decimal

from modules.finance.domain.cash_flow_forecast import (
    CashFlowItem,
    StuckStockItem,
    build_forecast,
    carrying_cost,
    compute_leverage,
    summarise_stuck_stock,
    week_start_for,
)

CRORE = Decimal("10000000")
MONDAY = date(2026, 9, 21)


def receivable(due: date, amount: Decimal, *, document_date: date | None = None) -> CashFlowItem:
    return CashFlowItem(
        due_date=due,
        amount=amount,
        category="receivable",
        reference="INV-1",
        document_date=document_date,
    )


def payable(due: date, amount: Decimal, *, document_date: date | None = None) -> CashFlowItem:
    return CashFlowItem(
        due_date=due,
        amount=amount,
        category="payable",
        reference="BILL-1",
        document_date=document_date,
    )


def test_week_start_is_the_monday_of_the_week() -> None:
    assert week_start_for(MONDAY) == MONDAY
    assert week_start_for(date(2026, 9, 24)) == MONDAY
    assert week_start_for(date(2026, 9, 27)) == MONDAY


def test_items_land_in_the_week_their_cash_moves() -> None:
    forecast = build_forecast(
        as_of=MONDAY,
        opening_balance=Decimal("1000000"),
        items=[
            receivable(MONDAY + timedelta(days=3), Decimal("500000")),
            payable(MONDAY + timedelta(days=10), Decimal("200000")),
        ],
    )

    assert forecast.weeks[0].inflow == Decimal("500000.00")
    assert forecast.weeks[0].closing_balance == Decimal("1500000.00")
    assert forecast.weeks[1].outflow == Decimal("200000.00")
    assert forecast.weeks[1].closing_balance == Decimal("1300000.00")
    assert forecast.closing_balance == Decimal("1300000.00")


def test_overdue_items_are_pulled_into_week_one() -> None:
    forecast = build_forecast(
        as_of=MONDAY,
        opening_balance=Decimal("0"),
        items=[
            receivable(MONDAY - timedelta(days=45), Decimal("300000")),
            payable(MONDAY - timedelta(days=20), Decimal("100000")),
        ],
    )

    assert forecast.overdue_inflow == Decimal("300000.00")
    assert forecast.overdue_outflow == Decimal("100000.00")
    assert forecast.weeks[0].inflow == Decimal("300000.00")
    assert forecast.weeks[0].outflow == Decimal("100000.00")


def test_items_beyond_the_horizon_are_excluded() -> None:
    forecast = build_forecast(
        as_of=MONDAY,
        opening_balance=Decimal("0"),
        items=[receivable(MONDAY + timedelta(weeks=20), CRORE)],
        horizon_weeks=13,
    )

    assert forecast.total_inflow == Decimal("0.00")
    assert len(forecast.weeks) == 13


def test_shortfall_weeks_are_flagged() -> None:
    forecast = build_forecast(
        as_of=MONDAY,
        opening_balance=Decimal("100000"),
        items=[payable(MONDAY + timedelta(days=2), Decimal("500000"))],
    )

    assert forecast.shortfall_weeks[0] == 1
    assert forecast.lowest_balance == Decimal("-400000.00")
    assert forecast.lowest_balance_week == 1


def test_stuck_stock_carry_cost_matches_the_eight_month_case() -> None:
    """1 cr held for 8 months at 1% a month is roughly 7 lakh a month gone."""
    summary = summarise_stuck_stock(
        [
            StuckStockItem(
                reference="PO-1",
                product_name="Switches",
                quantity=Decimal("10"),
                value=CRORE,
                received_on=MONDAY - timedelta(days=240),
                days_held=240,
            )
        ]
    )

    assert summary.total_value == CRORE
    assert summary.oldest_days_held == 240
    assert summary.monthly_carry_cost == Decimal("100000.00")
    # 1 cr x 1%/month x 8 months = 8 lakh already sunk.
    assert summary.carry_cost_to_date == Decimal("800000.00")


def test_stuck_stock_summary_is_empty_when_nothing_is_held() -> None:
    summary = summarise_stuck_stock([])
    assert summary.total_value == Decimal("0.00")
    assert summary.unit_count == 0
    assert summary.monthly_carry_cost == Decimal("0.00")


def test_stuck_stock_items_are_ordered_oldest_first() -> None:
    summary = summarise_stuck_stock(
        [
            StuckStockItem(
                reference="PO-NEW",
                product_name="A",
                quantity=Decimal("1"),
                value=Decimal("1000"),
                received_on=MONDAY,
                days_held=10,
            ),
            StuckStockItem(
                reference="PO-OLD",
                product_name="B",
                quantity=Decimal("1"),
                value=Decimal("1000"),
                received_on=MONDAY,
                days_held=200,
            ),
        ]
    )

    assert [i.reference for i in summary.items] == ["PO-OLD", "PO-NEW"]


def test_paying_later_than_we_collect_is_float_we_earn_on() -> None:
    leverage = compute_leverage(
        [
            receivable(
                MONDAY + timedelta(days=30),
                CRORE,
                document_date=MONDAY,
            ),
            payable(
                MONDAY + timedelta(days=60),
                CRORE * 3,
                document_date=MONDAY,
            ),
        ]
    )

    assert leverage is not None
    assert leverage.collection_days == 30
    assert leverage.payment_days == 60
    assert leverage.leverage_days == 30
    assert "float" in leverage.narrative


def test_collecting_later_than_we_pay_costs_money() -> None:
    leverage = compute_leverage(
        [
            receivable(MONDAY + timedelta(days=90), CRORE, document_date=MONDAY),
            payable(MONDAY + timedelta(days=30), CRORE * 3, document_date=MONDAY),
        ]
    )

    assert leverage is not None
    assert leverage.leverage_days == -60
    assert "Negotiate longer supplier terms" in leverage.narrative


def test_leverage_is_absent_without_any_open_documents() -> None:
    assert compute_leverage([]) is None


def test_carrying_cost_is_one_percent_per_month() -> None:
    assert carrying_cost(CRORE, 30) == Decimal("100000.00")
    assert carrying_cost(CRORE, 60) == Decimal("200000.00")
    assert carrying_cost(CRORE, 0) == Decimal("0.00")


def test_committed_purchase_orders_are_treated_as_outflows() -> None:
    forecast = build_forecast(
        as_of=MONDAY,
        opening_balance=Decimal("1000000"),
        items=[
            CashFlowItem(
                due_date=MONDAY + timedelta(days=5),
                amount=Decimal("400000"),
                category="committed_po",
                reference="PO-77",
            )
        ],
    )

    assert forecast.weeks[0].outflow == Decimal("400000.00")
    assert forecast.closing_balance == Decimal("600000.00")
