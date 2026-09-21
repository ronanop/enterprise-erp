"""Unit tests for party registration credit evaluation rules."""

from decimal import Decimal

from modules.master_data.domain.credit_evaluation import (
    carrying_cost,
    evaluate_customer_credit,
    evaluate_vendor_terms,
)

CRORE = Decimal("10000000")


def test_requested_credit_far_above_turnover_is_rejected() -> None:
    """A customer turning over 2 cr a year asking for 7 cr of credit."""
    result = evaluate_customer_credit(
        declared_annual_turnover=CRORE * 2,
        requested_credit_limit=CRORE * 7,
        requested_credit_days=120,
    )

    assert result.risk_band == "unacceptable"
    assert result.decision == "reject"
    # 2cr x 120/365 = ~65.75 lakh is all that turnover supports.
    assert result.turnover_based_ceiling == Decimal("6575342.47")
    assert result.recommended_credit_limit == result.turnover_based_ceiling
    assert result.exposure_ratio_pct == Decimal("350.00")


def test_modest_request_within_ceiling_is_approved() -> None:
    result = evaluate_customer_credit(
        declared_annual_turnover=CRORE * 10,
        requested_credit_limit=Decimal("5000000"),
        requested_credit_days=60,
    )

    assert result.risk_band == "low"
    assert result.decision == "approve"
    assert result.recommended_credit_limit == Decimal("5000000.00")
    assert result.funding_gap_days == 0
    assert result.funding_carry_cost == Decimal("0.00")


def test_extra_credit_days_beyond_supplier_terms_are_priced() -> None:
    """Customer wants 120 days; the market gives us 60. The gap costs money."""
    result = evaluate_customer_credit(
        declared_annual_turnover=CRORE * 50,
        requested_credit_limit=CRORE,
        requested_credit_days=120,
        supplier_credit_days=60,
    )

    assert result.funding_gap_days == 60
    # 1 cr at 1%/month for 60 days = 2 lakh.
    assert result.funding_carry_cost == Decimal("200000.00")
    assert result.recommended_credit_days == 60
    assert any("60-day gap" in reason for reason in result.reasons)


def test_missing_turnover_is_referred_not_approved() -> None:
    result = evaluate_customer_credit(
        declared_annual_turnover=None,
        requested_credit_limit=CRORE,
        requested_credit_days=60,
    )

    assert result.decision == "refer"
    assert result.recommended_credit_limit == Decimal("0.00")
    assert "turnover is missing" in result.reasons[0]


def test_carrying_cost_matches_one_percent_per_month() -> None:
    assert carrying_cost(CRORE, 30) == Decimal("100000.00")
    assert carrying_cost(CRORE, 0) == Decimal("0.00")
    assert carrying_cost(Decimal("0"), 90) == Decimal("0.00")


def test_vendor_terms_longer_than_our_collection_cycle_earn_float() -> None:
    result = evaluate_vendor_terms(
        offered_credit_days=60,
        customer_credit_days=30,
        expected_monthly_spend=CRORE,
    )

    assert result.leverage_days == 30
    assert result.leverage_value == Decimal("100000.00")
    assert result.recommended_action == "accept_terms"


def test_vendor_terms_shorter_than_collection_cycle_prompt_negotiation() -> None:
    result = evaluate_vendor_terms(
        offered_credit_days=15,
        customer_credit_days=60,
        expected_monthly_spend=CRORE,
    )

    assert result.leverage_days == -45
    assert result.recommended_action == "negotiate_longer_terms"
    assert any("Negotiate longer terms" in reason for reason in result.reasons)


def test_early_payment_discount_beats_holding_the_cash() -> None:
    result = evaluate_vendor_terms(
        offered_credit_days=60,
        customer_credit_days=30,
        expected_monthly_spend=CRORE,
        early_payment_discount_pct=Decimal("2"),
    )

    # 2% of 1 cr = 2 lakh, against 1 lakh of float from holding 30 extra days.
    assert result.early_payment_discount_value == Decimal("200000.00")
    assert result.leverage_value == Decimal("100000.00")
    assert result.recommended_action == "take_early_payment_discount"
