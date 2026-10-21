from datetime import date
from decimal import Decimal

from modules.payroll.domain.payslip_document_builder import build_payslip_document, format_payslip_text


def test_payslip_document_and_text():
    doc = build_payslip_document(
        period_code="PAY-2026-02",
        period_name="Payroll Feb 2026",
        period_start=date(2026, 1, 20),
        period_end=date(2026, 2, 19),
        employee_id="emp-1",
        employee_code="E001",
        employee_name="Test User",
        payroll_run_id="run-1",
        payroll_run_line_id="line-1",
        paid_days=Decimal("30"),
        period_days=Decimal("30"),
        lop_days=Decimal("0"),
        leave_days=Decimal("2"),
        gross_earnings=Decimal("30000"),
        total_deductions=Decimal("1800"),
        net_pay=Decimal("28200"),
        employer_contribution=Decimal("1900"),
        component_breakdown={
            "basic": 18000,
            "hra": 9000,
            "special_allowance": 3000,
            "pf_employee": 1800,
            "pf_employer": 1900,
            "pf_total": 3700,
            "gross": 30000,
            "net_pay_formula": "gross_minus_employee_pf_only",
        },
        day_summary={
            "counts": {
                "scheduled_working": 22,
                "week_off": 8,
                "holiday": 0,
                "present": 22,
                "paid_leave": 2,
                "lop": 0,
            }
        },
    )
    assert doc["attendance"]["payable_days"] == 30.0
    assert doc["attendance"]["present"] == 22.0
    assert doc["summary"]["net_pay"] == 28200.0
    assert "Payable days" in doc["export_text"]
    assert "NET PAY" in doc["export_text"]
    assert "₹28,200.00" in doc["export_text"]
    assert format_payslip_text(doc) == doc["export_text"]
    assert "late_count" not in doc["attendance"]


def test_variable_pay_is_not_listed_twice_when_already_inside_the_split():
    doc = build_payslip_document(
        period_code="PAY-2026-02",
        period_name="Payroll Feb 2026",
        period_start=date(2026, 1, 20),
        period_end=date(2026, 2, 19),
        employee_id="emp-1",
        employee_code="E001",
        employee_name="Test User",
        payroll_run_id="run-1",
        payroll_run_line_id="line-1",
        paid_days=Decimal("30"),
        period_days=Decimal("30"),
        lop_days=Decimal("0"),
        leave_days=Decimal("0"),
        gross_earnings=Decimal("30000"),
        total_deductions=Decimal("1800"),
        net_pay=Decimal("28200"),
        employer_contribution=Decimal("1900"),
        component_breakdown={
            "basic": 18000,
            "hra": 9000,
            "special_allowance": 3000,
            "bonus": 5000,
            "gross": 30000,
        },
        day_summary={"counts": {"late": 1, "present": 20, "scheduled_working": 22}},
    )
    labels = [row["label"] for row in doc["earnings"]]
    assert "Bonus" not in labels
    assert doc["attendance"]["late_count"] == 1.0


def test_variable_pay_is_listed_when_it_is_outside_the_split():
    doc = build_payslip_document(
        period_code="PAY-2026-02",
        period_name="Payroll Feb 2026",
        period_start=date(2026, 1, 20),
        period_end=date(2026, 2, 19),
        employee_id="emp-1",
        employee_code="E001",
        employee_name="Test User",
        payroll_run_id="run-1",
        payroll_run_line_id="line-1",
        paid_days=Decimal("30"),
        period_days=Decimal("30"),
        lop_days=Decimal("0"),
        leave_days=Decimal("0"),
        gross_earnings=Decimal("35000"),
        total_deductions=Decimal("1800"),
        net_pay=Decimal("33200"),
        employer_contribution=Decimal("1900"),
        component_breakdown={
            "basic": 18000,
            "hra": 9000,
            "special_allowance": 3000,
            "bonus": 5000,
            "gross": 35000,
        },
        day_summary=None,
    )
    bonus = next(row for row in doc["earnings"] if row["label"] == "Bonus")
    assert bonus["amount"] == 5000.0
