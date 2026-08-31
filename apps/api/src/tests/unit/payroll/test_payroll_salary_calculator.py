from decimal import Decimal

from modules.payroll.domain.payroll_policy_spec import default_company_payroll_policy_fields
from modules.payroll.domain.payroll_salary_calculator import (
    compute_net_and_deductions,
    compute_pf,
    split_earnings,
)
from modules.payroll.service.engines.payroll_run_engine import PayrollRunEngine


def test_full_month_30000_company_policy():
    policy = {**default_company_payroll_policy_fields(), "source": "test"}
    engine = PayrollRunEngine()
    result = engine.compute_salary_breakdown(
        30000,
        paid_days=Decimal("26"),
        period_days=Decimal("26"),
        prorate=False,
        policy=policy,
    )
    assert result["basic"] == Decimal("18000.0000")
    assert result["hra"] == Decimal("9000.0000")
    assert result["special_allowance"] == Decimal("3000.0000")
    assert result["net_pay"] == Decimal("26300.0000")
    bd = result["component_breakdown_json"]
    assert bd["pf_employee"] == 1800.0
    assert bd["pf_employer"] == 1900.0
    assert bd["pf_total"] == 3700.0


def test_prorated_gross_with_fixed_pf():
    policy = {**default_company_payroll_policy_fields(), "source": "test"}
    engine = PayrollRunEngine()
    result = engine.compute_salary_breakdown(
        30000,
        paid_days=Decimal("24"),
        period_days=Decimal("26"),
        prorate=True,
        policy=policy,
    )
  # 30000 * 24/26
    expected_gross = Decimal("27692.3077")
    assert result["gross_earnings"] == expected_gross
    assert result["net_pay"] == expected_gross - Decimal("3700.0000")


def test_split_earnings_helpers():
    policy = default_company_payroll_policy_fields()
    basic, hra, special = split_earnings(Decimal("50000"), policy)
    assert basic == Decimal("30000.0000")
    assert hra == Decimal("15000.0000")
    assert special == Decimal("5000.0000")
    pf = compute_pf(policy, gross=Decimal("50000"), basic=basic)
    assert pf["pf_employee"] == Decimal("1800.0000")
    assert pf["pf_employer"] == Decimal("1900.0000")
