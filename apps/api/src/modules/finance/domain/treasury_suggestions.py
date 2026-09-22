"""Surplus cash deployment suggestions.

Pure domain logic - no ORM, no framework imports, and no outbound calls.

Everything here is computed from the company's own forecast against a rate
table held locally. No balances, customer names or ledger data leave the
system to produce a suggestion.

The question being answered is narrow: money is sitting idle, the next call on
it is some weeks away, so what is the best thing to do with it until then?
Three kinds of answer are ranked together by annualised rate of return, so a
small high-yield option is not buried under a large low-yield one. They are not
mutually exclusive: taking a discount on one bill still leaves the rest of the
surplus to park.

* **Pay a supplier early** when they offer a discount. A 2% discount for paying
  60 days early is worth far more than any deposit, so it should outrank them.
* **Park it** in a deposit or liquid fund that matures before the money is
  needed.
* **Do nothing** when the forecast dips below the operating buffer, because the
  cash is not actually spare.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

DAYS_IN_YEAR = Decimal("365")
ZERO = Decimal("0.00")

# Cash kept back for payroll and day-to-day running, never deployed.
DEFAULT_OPERATING_BUFFER = Decimal("1000000")

MAX_SUGGESTIONS = 10


@dataclass(frozen=True, kw_only=True)
class Instrument:
    """An indicative place to park cash.

    Rates are indicative and meant to be overridden with the company's actual
    quotes; nothing here fetches live market data.
    """

    key: str
    name: str
    category: str
    annual_rate_pct: Decimal
    min_days: int
    max_days: int
    liquidity: str
    notes: str


DEFAULT_INSTRUMENTS: tuple[Instrument, ...] = (
    Instrument(
        key="sweep",
        name="Bank sweep / flexi deposit",
        category="deposit",
        annual_rate_pct=Decimal("4.5"),
        min_days=1,
        max_days=365,
        liquidity="same_day",
        notes="Breaks without penalty. Use when the money may be needed at short notice.",
    ),
    Instrument(
        key="overnight_fund",
        name="Overnight fund",
        category="mutual_fund",
        annual_rate_pct=Decimal("6.2"),
        min_days=1,
        max_days=30,
        liquidity="next_day",
        notes="Lowest risk fund category. Redemption credits the next working day.",
    ),
    Instrument(
        key="liquid_fund",
        name="Liquid fund",
        category="mutual_fund",
        annual_rate_pct=Decimal("6.8"),
        min_days=7,
        max_days=90,
        liquidity="next_day",
        notes="Exit load applies if redeemed within 7 days.",
    ),
    Instrument(
        key="fd_30",
        name="Fixed deposit, 30-45 days",
        category="deposit",
        annual_rate_pct=Decimal("6.5"),
        min_days=30,
        max_days=45,
        liquidity="on_maturity",
        notes="Premature withdrawal carries a rate penalty.",
    ),
    Instrument(
        key="fd_90",
        name="Fixed deposit, 46-90 days",
        category="deposit",
        annual_rate_pct=Decimal("7.0"),
        min_days=46,
        max_days=90,
        liquidity="on_maturity",
        notes="Premature withdrawal carries a rate penalty.",
    ),
    Instrument(
        key="ultra_short",
        name="Ultra short duration fund",
        category="mutual_fund",
        annual_rate_pct=Decimal("7.2"),
        min_days=90,
        max_days=180,
        liquidity="next_day",
        notes="Mild interest rate risk. Suited to a three to six month gap.",
    ),
    Instrument(
        key="fd_180",
        name="Fixed deposit, 91-180 days",
        category="deposit",
        annual_rate_pct=Decimal("7.25"),
        min_days=91,
        max_days=180,
        liquidity="on_maturity",
        notes="Best plain deposit rate for a six month horizon.",
    ),
    Instrument(
        key="fd_365",
        name="Fixed deposit, 181-365 days",
        category="deposit",
        annual_rate_pct=Decimal("7.4"),
        min_days=181,
        max_days=365,
        liquidity="on_maturity",
        notes="Only if the cash is genuinely not needed within the year.",
    ),
)


@dataclass(frozen=True, kw_only=True)
class EarlyPaymentOffer:
    """A supplier discount available for paying ahead of terms."""

    vendor_name: str
    reference: str
    amount: Decimal
    discount_pct: Decimal
    days_early: int


@dataclass(frozen=True, kw_only=True)
class TreasurySuggestion:
    rank: int
    kind: str
    title: str
    amount: Decimal
    days: int
    annual_rate_pct: Decimal
    expected_return: Decimal
    liquidity: str
    rationale: str

    def to_json(self) -> dict:
        return {
            "rank": self.rank,
            "kind": self.kind,
            "title": self.title,
            "amount": float(self.amount),
            "days": self.days,
            "annual_rate_pct": float(self.annual_rate_pct),
            "expected_return": float(self.expected_return),
            "liquidity": self.liquidity,
            "rationale": self.rationale,
        }


@dataclass(frozen=True, kw_only=True)
class TreasuryPlan:
    as_of: date
    deployable_amount: Decimal
    deployable_days: int
    operating_buffer: Decimal
    lowest_forecast_balance: Decimal
    total_opportunity: Decimal
    suggestions: list[TreasurySuggestion] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def simple_return(amount: Decimal, annual_rate_pct: Decimal, days: int) -> Decimal:
    if amount <= 0 or days <= 0 or annual_rate_pct <= 0:
        return ZERO
    return _money(amount * (annual_rate_pct / 100) * (Decimal(days) / DAYS_IN_YEAR))


@dataclass(frozen=True, kw_only=True)
class WeeklyBalance:
    """Closing balance for one forecast week."""

    week_number: int
    closing_balance: Decimal


def deployable_surplus(
    weekly_balances: list[WeeklyBalance],
    *,
    opening_balance: Decimal,
    operating_buffer: Decimal,
) -> tuple[Decimal, int]:
    """How much can be locked away, and for how many days.

    The deployable amount is bounded by the *lowest* point the balance reaches,
    not by today's balance: money that is needed in week six is not spare today.
    Because the amount is measured at the trough, locking it away still leaves
    the operating buffer intact in every week, so it can stay locked for the
    whole forecast window.
    """
    if not weekly_balances:
        spare = opening_balance - operating_buffer
        return (_money(spare) if spare > 0 else ZERO, 0)

    trough = min(min(b.closing_balance for b in weekly_balances), opening_balance)
    spare = trough - operating_buffer
    if spare <= 0:
        return (ZERO, 0)

    return (_money(spare), len(weekly_balances) * 7)


def build_plan(
    *,
    as_of: date,
    opening_balance: Decimal,
    weekly_balances: list[WeeklyBalance],
    operating_buffer: Decimal = DEFAULT_OPERATING_BUFFER,
    early_payment_offers: list[EarlyPaymentOffer] | None = None,
    instruments: tuple[Instrument, ...] = DEFAULT_INSTRUMENTS,
) -> TreasuryPlan:
    warnings: list[str] = []
    lowest = (
        min(b.closing_balance for b in weekly_balances)
        if weekly_balances
        else opening_balance
    )
    amount, days = deployable_surplus(
        weekly_balances,
        opening_balance=opening_balance,
        operating_buffer=operating_buffer,
    )

    if lowest < 0:
        warnings.append(
            f"The forecast goes negative ({_money(lowest)}) inside this window. "
            "Arrange funding before committing cash anywhere."
        )
    elif amount <= 0:
        warnings.append(
            f"Nothing is spare. The balance dips to {_money(lowest)} against an "
            f"operating buffer of {_money(operating_buffer)}."
        )

    candidates: list[TreasurySuggestion] = []

    # Paying a supplier early is usually the best return available, so it is
    # ranked alongside the deposits rather than treated separately.
    for offer in early_payment_offers or []:
        payable = min(offer.amount, amount) if amount > 0 else ZERO
        if payable <= 0 or offer.discount_pct <= 0:
            continue
        saving = _money(payable * offer.discount_pct / 100)
        implied_annual = (
            _money(offer.discount_pct * DAYS_IN_YEAR / Decimal(offer.days_early))
            if offer.days_early > 0
            else ZERO
        )
        candidates.append(
            TreasurySuggestion(
                rank=0,
                kind="early_payment",
                title=f"Pay {offer.vendor_name} early and take the discount",
                amount=payable,
                days=offer.days_early,
                annual_rate_pct=implied_annual,
                expected_return=saving,
                liquidity="committed",
                rationale=(
                    f"{offer.reference}: {offer.discount_pct}% off for paying "
                    f"{offer.days_early} days early saves {saving}. That is an effective "
                    f"{implied_annual}% a year, well above any deposit."
                ),
            )
        )

    if amount > 0 and days > 0:
        for instrument in instruments:
            if instrument.min_days > days:
                continue
            held_days = min(days, instrument.max_days)
            expected = simple_return(amount, instrument.annual_rate_pct, held_days)
            if expected <= 0:
                continue
            candidates.append(
                TreasurySuggestion(
                    rank=0,
                    kind=instrument.category,
                    title=f"Park {amount} in {instrument.name}",
                    amount=amount,
                    days=held_days,
                    annual_rate_pct=instrument.annual_rate_pct,
                    expected_return=expected,
                    liquidity=instrument.liquidity,
                    rationale=(
                        f"{held_days} days at {instrument.annual_rate_pct}% earns about "
                        f"{expected}. {instrument.notes}"
                    ),
                )
            )

    # Rate first, then rupees: the options use different amounts of cash, so
    # absolute return alone would rank a big cheap deposit above a small
    # high-yield discount.
    candidates.sort(key=lambda s: (s.annual_rate_pct, s.expected_return), reverse=True)
    ranked = [
        TreasurySuggestion(
            rank=index + 1,
            kind=s.kind,
            title=s.title,
            amount=s.amount,
            days=s.days,
            annual_rate_pct=s.annual_rate_pct,
            expected_return=s.expected_return,
            liquidity=s.liquidity,
            rationale=s.rationale,
        )
        for index, s in enumerate(candidates[:MAX_SUGGESTIONS])
    ]

    return TreasuryPlan(
        as_of=as_of,
        deployable_amount=amount,
        deployable_days=days,
        operating_buffer=_money(operating_buffer),
        lowest_forecast_balance=_money(lowest),
        total_opportunity=_money(ranked[0].expected_return) if ranked else ZERO,
        suggestions=ranked,
        warnings=warnings,
    )
