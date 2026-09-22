"""Rolling cash flow forecast rules.

Pure domain logic - no ORM, no framework imports.

The statutory cash flow statement looks backwards. This looks forward: it takes
every receivable due date, every payable due date, and every committed purchase
order, drops them into weekly buckets, and runs the cash balance forward so the
weeks that go short are visible before they arrive.

Two things that a ledger alone will not show are folded in:

* **Stuck stock.** Goods bought against a customer order, received, and then
  parked because the site is not ready. The money is already spent, the invoice
  cannot be raised, and the holding is financed at the borrowing rate.
* **Working capital leverage.** The spread between the days we pay suppliers and
  the days our customers pay us. A positive spread is float we earn on; a
  negative one is funded out of pocket.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

DEFAULT_HORIZON_WEEKS = 13
DEFAULT_MONTHLY_INTEREST_RATE_PCT = Decimal("1.0")

DAYS_IN_MONTH = Decimal("30")
ZERO = Decimal("0.00")

INFLOW_CATEGORIES = frozenset({"receivable"})
OUTFLOW_CATEGORIES = frozenset({"payable", "committed_po"})


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True, kw_only=True)
class CashFlowItem:
    """One dated cash movement. Amounts are always positive magnitudes."""

    due_date: date
    amount: Decimal
    category: str
    reference: str
    counterparty: str | None = None
    document_date: date | None = None

    @property
    def is_inflow(self) -> bool:
        return self.category in INFLOW_CATEGORIES


@dataclass(frozen=True, kw_only=True)
class StuckStockItem:
    """Goods received and paid for, but not yet delivered to the customer."""

    reference: str
    product_name: str
    quantity: Decimal
    value: Decimal
    received_on: date | None
    days_held: int
    on_hold: bool = False
    hold_reason: str | None = None


@dataclass(frozen=True, kw_only=True)
class StuckStockSummary:
    total_value: Decimal
    unit_count: int
    oldest_days_held: int
    monthly_carry_cost: Decimal
    carry_cost_to_date: Decimal
    on_hold_value: Decimal
    items: list[StuckStockItem] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "total_value": float(self.total_value),
            "unit_count": self.unit_count,
            "oldest_days_held": self.oldest_days_held,
            "monthly_carry_cost": float(self.monthly_carry_cost),
            "carry_cost_to_date": float(self.carry_cost_to_date),
            "on_hold_value": float(self.on_hold_value),
        }


@dataclass(frozen=True, kw_only=True)
class WorkingCapitalLeverage:
    """Spread between what we collect in and what we pay out in."""

    collection_days: int
    payment_days: int
    leverage_days: int
    average_monthly_outflow: Decimal
    leverage_value: Decimal
    narrative: str


@dataclass(frozen=True, kw_only=True)
class CashFlowWeek:
    week_number: int
    week_start: date
    week_end: date
    inflow: Decimal
    outflow: Decimal
    net: Decimal
    closing_balance: Decimal
    item_count: int


@dataclass(frozen=True, kw_only=True)
class CashFlowForecast:
    as_of: date
    horizon_weeks: int
    opening_balance: Decimal
    closing_balance: Decimal
    total_inflow: Decimal
    total_outflow: Decimal
    overdue_inflow: Decimal
    overdue_outflow: Decimal
    lowest_balance: Decimal
    lowest_balance_week: int | None
    shortfall_weeks: list[int]
    weeks: list[CashFlowWeek]
    stuck_stock: StuckStockSummary
    leverage: WorkingCapitalLeverage | None = None


def carrying_cost(
    amount: Decimal,
    days: int,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> Decimal:
    """Interest cost of holding `amount` for `days` at the given monthly rate."""
    if amount <= 0 or days <= 0:
        return ZERO
    return _money(amount * (monthly_interest_rate_pct / 100) * (Decimal(days) / DAYS_IN_MONTH))


def week_start_for(as_of: date) -> date:
    """Monday of the week containing `as_of`."""
    return as_of - timedelta(days=as_of.weekday())


def summarise_stuck_stock(
    items: list[StuckStockItem],
    *,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> StuckStockSummary:
    if not items:
        return StuckStockSummary(
            total_value=ZERO,
            unit_count=0,
            oldest_days_held=0,
            monthly_carry_cost=ZERO,
            carry_cost_to_date=ZERO,
            on_hold_value=ZERO,
            items=[],
        )

    total_value = sum((item.value for item in items), ZERO)
    on_hold_value = sum((item.value for item in items if item.on_hold), ZERO)
    carry_to_date = sum(
        (carrying_cost(item.value, item.days_held, monthly_interest_rate_pct) for item in items),
        ZERO,
    )

    return StuckStockSummary(
        total_value=_money(total_value),
        unit_count=len(items),
        oldest_days_held=max(item.days_held for item in items),
        monthly_carry_cost=carrying_cost(total_value, 30, monthly_interest_rate_pct),
        carry_cost_to_date=_money(carry_to_date),
        on_hold_value=_money(on_hold_value),
        items=sorted(items, key=lambda i: i.days_held, reverse=True),
    )


def _weighted_average_days(items: list[CashFlowItem]) -> int:
    """Value-weighted terms across a set of open documents."""
    weighted = ZERO
    total = ZERO
    for item in items:
        if item.document_date is None or item.amount <= 0:
            continue
        days = (item.due_date - item.document_date).days
        weighted += Decimal(days) * item.amount
        total += item.amount
    if total <= 0:
        return 0
    return int((weighted / total).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def compute_leverage(
    items: list[CashFlowItem],
    *,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> WorkingCapitalLeverage | None:
    receivables = [i for i in items if i.category == "receivable"]
    payables = [i for i in items if i.category == "payable"]
    if not receivables and not payables:
        return None

    collection_days = _weighted_average_days(receivables)
    payment_days = _weighted_average_days(payables)
    leverage_days = payment_days - collection_days

    outflow_total = sum((i.amount for i in payables), ZERO)
    # Open payables typically span a quarter; normalise to a monthly run rate.
    average_monthly_outflow = _money(outflow_total / 3) if outflow_total > 0 else ZERO
    leverage_value = carrying_cost(
        average_monthly_outflow, abs(leverage_days), monthly_interest_rate_pct
    )

    if leverage_days > 0:
        narrative = (
            f"Suppliers are paid at {payment_days} days while customers pay at "
            f"{collection_days}, leaving {leverage_days} days of float worth about "
            f"{leverage_value} a month at {monthly_interest_rate_pct}% per month."
        )
    elif leverage_days < 0:
        narrative = (
            f"Customers pay at {collection_days} days but suppliers are paid at "
            f"{payment_days}, so {abs(leverage_days)} days are funded from working "
            f"capital at about {leverage_value} a month. Negotiate longer supplier terms."
        )
    else:
        narrative = (
            f"Collection and payment cycles both sit at {payment_days} days, so there "
            "is no float either way."
        )

    return WorkingCapitalLeverage(
        collection_days=collection_days,
        payment_days=payment_days,
        leverage_days=leverage_days,
        average_monthly_outflow=average_monthly_outflow,
        leverage_value=leverage_value,
        narrative=narrative,
    )


def build_forecast(
    *,
    as_of: date,
    opening_balance: Decimal,
    items: list[CashFlowItem],
    stuck_stock: list[StuckStockItem] | None = None,
    horizon_weeks: int = DEFAULT_HORIZON_WEEKS,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> CashFlowForecast:
    """Roll `items` into weekly buckets and carry the balance forward.

    Anything already past due lands in week 1: it is cash that should have moved
    and has not, so hiding it in a historical bucket would overstate the
    position.
    """
    first_week_start = week_start_for(as_of)
    buckets: dict[int, list[CashFlowItem]] = {w: [] for w in range(1, horizon_weeks + 1)}
    overdue_inflow = ZERO
    overdue_outflow = ZERO

    for item in items:
        if item.amount <= 0:
            continue
        offset_days = (item.due_date - first_week_start).days
        week_index = offset_days // 7 + 1
        if week_index < 1:
            week_index = 1
            if item.is_inflow:
                overdue_inflow += item.amount
            else:
                overdue_outflow += item.amount
        elif week_index > horizon_weeks:
            continue
        buckets[week_index].append(item)

    weeks: list[CashFlowWeek] = []
    balance = opening_balance
    total_inflow = ZERO
    total_outflow = ZERO
    lowest_balance = opening_balance
    lowest_week: int | None = None
    shortfall_weeks: list[int] = []

    for week_number in range(1, horizon_weeks + 1):
        bucket = buckets[week_number]
        inflow = sum((i.amount for i in bucket if i.is_inflow), ZERO)
        outflow = sum((i.amount for i in bucket if not i.is_inflow), ZERO)
        net = inflow - outflow
        balance += net
        total_inflow += inflow
        total_outflow += outflow

        if balance < lowest_balance:
            lowest_balance = balance
            lowest_week = week_number
        if balance < 0:
            shortfall_weeks.append(week_number)

        week_start = first_week_start + timedelta(weeks=week_number - 1)
        weeks.append(
            CashFlowWeek(
                week_number=week_number,
                week_start=week_start,
                week_end=week_start + timedelta(days=6),
                inflow=_money(inflow),
                outflow=_money(outflow),
                net=_money(net),
                closing_balance=_money(balance),
                item_count=len(bucket),
            )
        )

    return CashFlowForecast(
        as_of=as_of,
        horizon_weeks=horizon_weeks,
        opening_balance=_money(opening_balance),
        closing_balance=_money(balance),
        total_inflow=_money(total_inflow),
        total_outflow=_money(total_outflow),
        overdue_inflow=_money(overdue_inflow),
        overdue_outflow=_money(overdue_outflow),
        lowest_balance=_money(lowest_balance),
        lowest_balance_week=lowest_week,
        shortfall_weeks=shortfall_weeks,
        weeks=weeks,
        stuck_stock=summarise_stuck_stock(
            stuck_stock or [], monthly_interest_rate_pct=monthly_interest_rate_pct
        ),
        leverage=compute_leverage(items, monthly_interest_rate_pct=monthly_interest_rate_pct),
    )
