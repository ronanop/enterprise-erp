"""Credit evaluation rules for party registration.

Pure domain logic - no ORM, no framework imports.

A customer asking for credit is assessed against the turnover they declare, not
against what the sales team hopes to sell them. The ceiling is the receivable a
supplier could sustainably carry if it won the customer's entire annual spend:

    ceiling = declared_annual_turnover x (credit_days / 365)

Anything materially above that ceiling means the requested exposure is larger
than the customer's own business can generate over the credit period.

Granting a customer more credit days than our own suppliers give us has to be
funded from working capital, so the gap is priced at the unsecured borrowing
rate. The mirror case - a vendor granting us more days than we give our
customers - is a float we earn on, and is valued the same way.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

# Unsecured working capital is priced at roughly 1% a month (~18% a year).
DEFAULT_MONTHLY_INTEREST_RATE_PCT = Decimal("1.0")

# Credit days we can typically negotiate from the market as a buyer.
DEFAULT_SUPPLIER_CREDIT_DAYS = 60

DAYS_IN_YEAR = Decimal("365")
DAYS_IN_MONTH = Decimal("30")

# Requested limit as a multiple of the turnover-based ceiling.
RISK_BAND_THRESHOLDS: tuple[tuple[Decimal, str], ...] = (
    (Decimal("0.5"), "low"),
    (Decimal("1.0"), "moderate"),
    (Decimal("2.0"), "high"),
)
UNACCEPTABLE_BAND = "unacceptable"

DECISION_BY_BAND: dict[str, str] = {
    "low": "approve",
    "moderate": "approve_with_conditions",
    "high": "refer",
    UNACCEPTABLE_BAND: "reject",
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True, kw_only=True)
class CustomerCreditEvaluation:
    """Outcome of assessing a customer's requested credit terms."""

    declared_annual_turnover: Decimal
    requested_credit_limit: Decimal
    requested_credit_days: int
    turnover_based_ceiling: Decimal
    exposure_ratio_pct: Decimal
    ceiling_multiple: Decimal
    risk_band: str
    decision: str
    recommended_credit_limit: Decimal
    recommended_credit_days: int
    funding_gap_days: int
    funding_carry_cost: Decimal
    reasons: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "kind": "customer_credit",
            "declared_annual_turnover": float(self.declared_annual_turnover),
            "requested_credit_limit": float(self.requested_credit_limit),
            "requested_credit_days": self.requested_credit_days,
            "turnover_based_ceiling": float(self.turnover_based_ceiling),
            "exposure_ratio_pct": float(self.exposure_ratio_pct),
            "ceiling_multiple": float(self.ceiling_multiple),
            "risk_band": self.risk_band,
            "decision": self.decision,
            "recommended_credit_limit": float(self.recommended_credit_limit),
            "recommended_credit_days": self.recommended_credit_days,
            "funding_gap_days": self.funding_gap_days,
            "funding_carry_cost": float(self.funding_carry_cost),
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True, kw_only=True)
class VendorTermsEvaluation:
    """Working-capital value of the payment terms a vendor offers us."""

    offered_credit_days: int
    customer_credit_days: int
    expected_monthly_spend: Decimal
    leverage_days: int
    leverage_value: Decimal
    early_payment_discount_pct: Decimal
    early_payment_discount_value: Decimal
    recommended_action: str
    reasons: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "kind": "vendor_terms",
            "offered_credit_days": self.offered_credit_days,
            "customer_credit_days": self.customer_credit_days,
            "expected_monthly_spend": float(self.expected_monthly_spend),
            "leverage_days": self.leverage_days,
            "leverage_value": float(self.leverage_value),
            "early_payment_discount_pct": float(self.early_payment_discount_pct),
            "early_payment_discount_value": float(self.early_payment_discount_value),
            "recommended_action": self.recommended_action,
            "reasons": list(self.reasons),
        }


def carrying_cost(
    amount: Decimal,
    days: int,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> Decimal:
    """Interest cost of holding `amount` for `days` at the given monthly rate."""
    if amount <= 0 or days <= 0:
        return Decimal("0.00")
    return _money(amount * (monthly_interest_rate_pct / 100) * (Decimal(days) / DAYS_IN_MONTH))


def _risk_band(ceiling_multiple: Decimal) -> str:
    for threshold, band in RISK_BAND_THRESHOLDS:
        if ceiling_multiple <= threshold:
            return band
    return UNACCEPTABLE_BAND


def evaluate_customer_credit(
    *,
    declared_annual_turnover: Decimal | None,
    requested_credit_limit: Decimal | None,
    requested_credit_days: int | None,
    supplier_credit_days: int = DEFAULT_SUPPLIER_CREDIT_DAYS,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> CustomerCreditEvaluation:
    turnover = Decimal(str(declared_annual_turnover or 0))
    requested_limit = Decimal(str(requested_credit_limit or 0))
    requested_days = int(requested_credit_days or 0)
    reasons: list[str] = []

    if turnover <= 0:
        return CustomerCreditEvaluation(
            declared_annual_turnover=Decimal("0.00"),
            requested_credit_limit=_money(requested_limit),
            requested_credit_days=requested_days,
            turnover_based_ceiling=Decimal("0.00"),
            exposure_ratio_pct=Decimal("0.00"),
            ceiling_multiple=Decimal("0.00"),
            risk_band="high",
            decision="refer",
            recommended_credit_limit=Decimal("0.00"),
            recommended_credit_days=0,
            funding_gap_days=max(0, requested_days - supplier_credit_days),
            funding_carry_cost=Decimal("0.00"),
            reasons=[
                "Declared annual turnover is missing, so requested credit cannot be "
                "assessed. Collect audited turnover before extending any credit."
            ],
        )

    ceiling = _money(turnover * (Decimal(max(requested_days, 0)) / DAYS_IN_YEAR))
    exposure_ratio_pct = _money(requested_limit / turnover * 100)
    ceiling_multiple = (
        _money(requested_limit / ceiling) if ceiling > 0 else Decimal("0.00")
    )
    band = _risk_band(ceiling_multiple) if ceiling > 0 else "high"
    decision = DECISION_BY_BAND[band]

    recommended_limit = min(requested_limit, ceiling) if ceiling > 0 else Decimal("0.00")
    recommended_days = min(requested_days, supplier_credit_days) if requested_days else 0

    reasons.append(
        f"Requested exposure is {exposure_ratio_pct}% of declared annual turnover; "
        f"{requested_days} days of that turnover supports at most {ceiling}."
    )
    if requested_limit > ceiling:
        reasons.append(
            f"Requested limit exceeds the turnover-based ceiling by "
            f"{_money(requested_limit - ceiling)}. Recommended limit capped at {ceiling}."
        )

    funding_gap_days = max(0, requested_days - supplier_credit_days)
    carry_cost = carrying_cost(recommended_limit, funding_gap_days, monthly_interest_rate_pct)
    if funding_gap_days > 0:
        reasons.append(
            f"Customer wants {requested_days} days but our suppliers give us "
            f"{supplier_credit_days}. Funding the {funding_gap_days}-day gap on "
            f"{recommended_limit} costs about {carry_cost} at "
            f"{monthly_interest_rate_pct}% per month."
        )

    return CustomerCreditEvaluation(
        declared_annual_turnover=_money(turnover),
        requested_credit_limit=_money(requested_limit),
        requested_credit_days=requested_days,
        turnover_based_ceiling=ceiling,
        exposure_ratio_pct=exposure_ratio_pct,
        ceiling_multiple=ceiling_multiple,
        risk_band=band,
        decision=decision,
        recommended_credit_limit=_money(recommended_limit),
        recommended_credit_days=recommended_days,
        funding_gap_days=funding_gap_days,
        funding_carry_cost=carry_cost,
        reasons=reasons,
    )


def evaluate_vendor_terms(
    *,
    offered_credit_days: int | None,
    customer_credit_days: int = 30,
    expected_monthly_spend: Decimal | None = None,
    early_payment_discount_pct: Decimal | None = None,
    monthly_interest_rate_pct: Decimal = DEFAULT_MONTHLY_INTEREST_RATE_PCT,
) -> VendorTermsEvaluation:
    offered_days = int(offered_credit_days or 0)
    spend = Decimal(str(expected_monthly_spend or 0))
    discount_pct = Decimal(str(early_payment_discount_pct or 0))
    reasons: list[str] = []

    leverage_days = offered_days - customer_credit_days
    leverage_value = carrying_cost(spend, max(leverage_days, 0), monthly_interest_rate_pct)
    discount_value = _money(spend * discount_pct / 100) if spend > 0 else Decimal("0.00")

    if leverage_days > 0:
        reasons.append(
            f"Vendor gives {offered_days} days while we collect in "
            f"{customer_credit_days}, leaving {leverage_days} days of float worth "
            f"about {leverage_value} a cycle on {spend} of spend."
        )
    elif leverage_days < 0:
        shortfall = carrying_cost(spend, -leverage_days, monthly_interest_rate_pct)
        reasons.append(
            f"Vendor wants payment in {offered_days} days but we collect in "
            f"{customer_credit_days}, so {-leverage_days} days are funded from working "
            f"capital at a cost of about {shortfall} a cycle. Negotiate longer terms."
        )
    else:
        reasons.append("Vendor terms match our collection cycle; no float either way.")

    recommended_action = "accept_terms"
    if discount_value > leverage_value and discount_pct > 0:
        recommended_action = "take_early_payment_discount"
        reasons.append(
            f"Early payment discount of {discount_pct}% is worth {discount_value}, "
            f"more than the {leverage_value} earned by holding the cash. Pay early."
        )
    elif leverage_days < 0:
        recommended_action = "negotiate_longer_terms"

    return VendorTermsEvaluation(
        offered_credit_days=offered_days,
        customer_credit_days=customer_credit_days,
        expected_monthly_spend=_money(spend),
        leverage_days=leverage_days,
        leverage_value=leverage_value,
        early_payment_discount_pct=discount_pct,
        early_payment_discount_value=discount_value,
        recommended_action=recommended_action,
        reasons=reasons,
    )
