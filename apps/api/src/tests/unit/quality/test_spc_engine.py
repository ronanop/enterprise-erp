"""SPC Cp/Cpk and out-of-control evaluation tests."""

from decimal import Decimal
from uuid import uuid4

from modules.quality.service.engines.spc_engine import SpcEngine


def test_cp_cpk_from_rolling_window():
    engine = SpcEngine()
    values = [
        Decimal("14.8"),
        Decimal("15.0"),
        Decimal("15.2"),
        Decimal("14.9"),
        Decimal("15.1"),
        Decimal("15.0"),
    ]
    cap = engine.compute_capability(
        uuid4(),
        values,
        min_value=Decimal("10"),
        max_value=Decimal("20"),
        target_value=Decimal("15"),
    )
    assert cap.sample_count == 6
    assert cap.mean is not None
    assert cap.stdev is not None and cap.stdev > 0
    assert cap.cp is not None and cap.cp > 1
    assert cap.cpk is not None
    assert cap.cpk <= cap.cp
    # Two-sided centered process: Cpk close to Cp
    assert abs(cap.cp - cap.cpk) < Decimal("0.5")


def test_cp_cpk_none_when_sigma_zero():
    engine = SpcEngine()
    cap = engine.compute_capability(
        uuid4(),
        [Decimal("10")] * 6,
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
    )
    assert cap.stdev == Decimal("0.0000")
    assert cap.cp is None
    assert cap.cpk is None


def test_out_of_spec_is_out_of_control_major():
    engine = SpcEngine()
    result = engine.evaluate_point(
        Decimal("12"),
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
        prior_values=[],
    )
    assert result.is_out_of_spec is True
    assert result.is_out_of_control is True
    assert result.severity == "major"
    assert result.reason == "outside_spec_limit"


def test_far_out_of_spec_is_critical():
    engine = SpcEngine()
    result = engine.evaluate_point(
        Decimal("20"),
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
        prior_values=[],
    )
    assert result.severity == "critical"


def test_in_spec_not_out_of_control_without_history():
    engine = SpcEngine()
    result = engine.evaluate_point(
        Decimal("10"),
        min_value=Decimal("9"),
        max_value=Decimal("11"),
        target_value=Decimal("10"),
        prior_values=[],
    )
    assert result.is_out_of_control is False
