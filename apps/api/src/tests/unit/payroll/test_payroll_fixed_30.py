"""Fixed 30-day salary basis and sandwich/PF policy cases."""

from datetime import date
from decimal import Decimal

from modules.hr.domain.sandwich_rules import sandwich_off_dates
from modules.payroll.domain.payroll_day_ledger import payable_days_from_lop
from modules.payroll.domain.payroll_policy_spec import default_company_payroll_policy_fields
from modules.payroll.domain.payroll_salary_calculator import compute_pf, split_earnings
from modules.payroll.service.engines.payroll_run_engine import PayrollRunEngine


def _weekend(day: date) -> bool:
    return day.weekday() >= 5


def _policy(**overrides):
    return {**default_company_payroll_policy_fields(), "source": "test", **overrides}


def _pay(gross, paid, *, prorate=True, policy=None):
    engine = PayrollRunEngine()
    return engine.compute_salary_breakdown(
        gross,
        paid_days=Decimal(str(paid)),
        period_days=Decimal("30"),
        prorate=prorate,
        policy=policy or _policy(),
    )


def test_case_a_full_month_no_lop():
    """Present 22 + WO 8 + LOP 0 → payable 30, salary 30000."""
    assert payable_days_from_lop(Decimal("0")) == Decimal("30")
    result = _pay(30000, 30)
    assert result["gross_earnings"] == Decimal("30000.0000")
    assert result["component_breakdown_json"]["period_days"] == 30.0
    assert result["component_breakdown_json"]["paid_days"] == 30.0


def test_case_b_two_lop():
    """LOP 2 → payable 28, salary 28000."""
    assert payable_days_from_lop(Decimal("2")) == Decimal("28")
    result = _pay(30000, 28)
    assert result["gross_earnings"] == Decimal("28000.0000")


def test_case_c_one_lop():
    result = _pay(30000, 29)
    assert result["gross_earnings"] == Decimal("29000.0000")


def test_case_d_half_day():
    assert payable_days_from_lop(Decimal("0.5")) == Decimal("29.5")
    result = _pay(30000, Decimal("29.5"))
    assert result["gross_earnings"] == Decimal("29500.0000")


def test_case_n_no_attendance_full_pay():
    result = _pay(30000, 30, prorate=False)
    assert result["gross_earnings"] == Decimal("30000.0000")


def test_working_day_count_does_not_change_divisor():
    """22 vs 23 scheduled days still divide by 30."""
    a = _pay(30000, 30)
    b = _pay(30000, 30)
    assert a["gross_earnings"] == b["gross_earnings"] == Decimal("30000.0000")
    assert a["component_breakdown_json"]["period_days"] == 30.0


def test_case_h_sandwich_off_leave_surrounding_weekend():
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_off_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates={fri, mon},
        as_of=mon,
        trigger="unauthorized_absence",
    )
    assert dates == set()


def test_case_i_sandwich_on_approved_leave_becomes_lop():
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_off_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates={fri, mon},
        as_of=mon,
        trigger="approved_leave",
    )
    assert dates == {sat, sun}
    lop = Decimal(len(dates))
    assert payable_days_from_lop(lop) == Decimal("28")


def test_case_i_both_trigger_leave_surrounding_weekend():
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_off_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates={fri, mon},
        as_of=mon,
        trigger="both",
    )
    assert dates == {sat, sun}


def test_case_k_absent_weekend_absent_unauthorized():
    fri = date(2026, 7, 24)
    sat = date(2026, 7, 25)
    sun = date(2026, 7, 26)
    mon = date(2026, 7, 27)
    dates = sandwich_off_dates(
        date(2026, 7, 20),
        date(2026, 7, 31),
        is_non_working=_weekend,
        attendance_status_by_date={fri: "absent", mon: "absent"},
        approved_leave_dates=set(),
        as_of=mon,
        trigger="unauthorized_absence",
    )
    assert dates == {sat, sun}


def test_case_l_pf_fixed():
    policy = _policy()
    result = _pay(30000, 28, policy=policy)
    bd = result["component_breakdown_json"]
    assert bd["pf_employee"] == 1800.0
    assert bd["pf_employer"] == 1900.0
    assert result["total_deductions"] == Decimal("1800.0000")
    assert result["employer_contribution"] == Decimal("1900.0000")


def test_pf_not_reduced_when_salary_prorated():
    """LOP scales gross; employee PF stays the monthly ₹1,800."""
    policy = _policy()
    engine = PayrollRunEngine()
    result = engine.compute_salary_breakdown(
        28200,
        paid_days=Decimal("20.5"),
        period_days=Decimal("23"),
        prorate=True,
        policy=policy,
    )
    assert result["pf_employee"] == Decimal("1800.0000")
    assert result["total_deductions"] == Decimal("1800.0000")
    assert result["net_pay"] == result["gross_earnings"] - Decimal("1800.0000")


def test_case_m_pf_percentage():
    policy = _policy(pf_mode="percentage", pf_employee_percent=Decimal("0.12"), pf_employer_percent=Decimal("0.12"))
    basic, _, _ = split_earnings(Decimal("30000"), policy)
    pf = compute_pf(policy, gross=Decimal("30000"), basic=basic)
    assert pf["pf_employee"] == Decimal("1800.0000")
    assert pf["pf_employer"] == Decimal("1800.0000")


def test_basic_hra_special_from_payable_gross():
    result = _pay(30000, 28)
    assert result["basic"] == Decimal("16800.0000")
    assert result["hra"] == Decimal("8400.0000")
    assert result["special_allowance"] == Decimal("2800.0000")
