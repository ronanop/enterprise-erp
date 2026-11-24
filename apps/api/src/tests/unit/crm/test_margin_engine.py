"""Quote line margin is markup on cost (matches quote UI)."""

from decimal import Decimal

from modules.crm.service.engines.margin_engine import compute_line_margin, evaluate_quote_margin


def test_compute_line_margin_preserves_entered_markup() -> None:
    # Cost 100, sell 110 => 10% markup (not ~9.091% margin-on-sell).
    result = compute_line_margin(Decimal("1"), Decimal("100"), Decimal("110"))
    assert result.margin_pct == Decimal("10.0000000000")
    assert result.margin_amount == Decimal("10.0000")
    assert result.line_total == Decimal("110.0000")


def test_entered_margin_pct_quantizes_to_ten_decimal_places() -> None:
    from modules.crm.service.quote_service import _quantize_margin_pct

    assert _quantize_margin_pct("7.12345678901234") == Decimal("7.1234567890")
    assert _quantize_margin_pct("10") == Decimal("10.0000000000")


def test_compute_line_margin_zero_cost() -> None:
    result = compute_line_margin(Decimal("2"), Decimal("0"), Decimal("50"))
    assert result.margin_pct == Decimal("0")
    assert result.margin_amount == Decimal("100.0000")


def test_evaluate_quote_margin_avg_is_markup_mean() -> None:
    result = evaluate_quote_margin(
        [
            ("hardware", Decimal("1"), Decimal("100"), Decimal("110")),
            ("software", Decimal("1"), Decimal("50"), Decimal("60")),
        ]
    )
    assert result.avg_margin_pct == Decimal("15.0000000000")
    assert result.requires_management_approval is False
