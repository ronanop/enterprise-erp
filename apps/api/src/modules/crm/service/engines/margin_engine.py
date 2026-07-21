"""Quote margin rules and OVF finance-cost computation.

Product rules enforced here:
  6. Margin: HW/SW min 7%, Services min 20%. At/below the threshold the quote
     is locked pending Management approval. A "mixed" quote (both
     hardware/software AND services lines) must meet the stricter (higher)
     of the two thresholds.
  7. Finance cost: ~0.5% per 15 days of payment gap (customer payment terms
     minus vendor payment terms).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_CEILING, Decimal
from typing import Iterable

MIN_MARGIN_PCT: dict[str, Decimal] = {
    "hardware": Decimal("7"),
    "software": Decimal("7"),
    "services": Decimal("20"),
}

FINANCE_COST_PCT_PER_15_DAYS = Decimal("0.5")


@dataclass(frozen=True)
class LineMargin:
    margin_pct: Decimal
    margin_amount: Decimal
    line_total: Decimal


@dataclass(frozen=True)
class QuoteMarginResult:
    avg_margin_pct: Decimal
    total_margin_amount: Decimal
    total_sell_amount: Decimal
    required_threshold_pct: Decimal
    requires_management_approval: bool
    line_types_present: set[str] = field(default_factory=set)


def compute_line_margin(qty: Decimal, unit_cost: Decimal, unit_sell: Decimal) -> LineMargin:
    qty = Decimal(str(qty))
    unit_cost = Decimal(str(unit_cost))
    unit_sell = Decimal(str(unit_sell))
    line_total = (qty * unit_sell).quantize(Decimal("0.0001"))
    total_cost = (qty * unit_cost).quantize(Decimal("0.0001"))
    margin_amount = (line_total - total_cost).quantize(Decimal("0.0001"))
    if unit_sell == 0:
        margin_pct = Decimal("0")
    else:
        margin_pct = (margin_amount / line_total * Decimal("100")).quantize(Decimal("0.001"))
    return LineMargin(margin_pct=margin_pct, margin_amount=margin_amount, line_total=line_total)


def required_threshold_for(line_types: Iterable[str]) -> Decimal:
    """Mixed lines (hw/sw + services) => stricter (higher) threshold applies."""
    types = {t for t in line_types if t}
    thresholds = [MIN_MARGIN_PCT.get(t, Decimal("7")) for t in types]
    if not thresholds:
        return Decimal("7")
    return max(thresholds)


def evaluate_quote_margin(
    lines: Iterable[tuple[str, Decimal, Decimal, Decimal]],
) -> QuoteMarginResult:
    """``lines`` is an iterable of (line_type, qty, unit_cost, unit_sell)."""
    total_sell = Decimal("0")
    total_margin = Decimal("0")
    line_types: set[str] = set()
    for line_type, qty, unit_cost, unit_sell in lines:
        line_types.add(line_type)
        result = compute_line_margin(qty, unit_cost, unit_sell)
        total_sell += result.line_total
        total_margin += result.margin_amount

    if total_sell == 0:
        avg_margin_pct = Decimal("0")
    else:
        avg_margin_pct = (total_margin / total_sell * Decimal("100")).quantize(Decimal("0.001"))

    threshold = required_threshold_for(line_types)
    requires_approval = avg_margin_pct <= threshold

    return QuoteMarginResult(
        avg_margin_pct=avg_margin_pct,
        total_margin_amount=total_margin.quantize(Decimal("0.0001")),
        total_sell_amount=total_sell.quantize(Decimal("0.0001")),
        required_threshold_pct=threshold,
        requires_management_approval=requires_approval,
        line_types_present=line_types,
    )


def compute_finance_cost_pct(vendor_payment_days: int, customer_payment_days: int) -> Decimal:
    """~0.5% per 15 days of payment gap.

    The "gap" is how long the business must fund the deal out of pocket:
    the number of days it pays the vendor before it collects from the
    customer. A non-positive gap (customer pays before/at the same time the
    vendor is paid) costs nothing.
    """
    gap_days = Decimal(int(customer_payment_days) - int(vendor_payment_days))
    if gap_days <= 0:
        return Decimal("0.000")
    periods = (gap_days / Decimal("15")).to_integral_value(rounding=ROUND_CEILING)
    return (periods * FINANCE_COST_PCT_PER_15_DAYS).quantize(Decimal("0.001"))
