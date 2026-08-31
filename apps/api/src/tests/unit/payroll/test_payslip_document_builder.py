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
        paid_days=Decimal("26"),
        period_days=Decimal("26"),
        lop_days=Decimal("0"),
        leave_days=Decimal("2"),
        gross_earnings=Decimal("30000"),
        total_deductions=Decimal("3700"),
        net_pay=Decimal("26300"),
        employer_contribution=Decimal("1900"),
        component_breakdown={
            "basic": 18000,
            "hra": 9000,
            "special_allowance": 3000,
            "pf_employee": 1800,
            "pf_employer": 1900,
            "pf_total": 3700,
            "gross": 30000,
            "net_pay_formula": "gross_minus_fixed_pf_total",
        },
        day_summary={
            "counts": {
                "scheduled_working": 26,
                "paid_leave": 2,
                "lop": 0,
            }
        },
    )
    assert doc["summary"]["net_pay"] == 26300.0
    assert "NET PAY" in doc["export_text"]
    assert "₹26,300.00" in doc["export_text"]
    assert format_payslip_text(doc) == doc["export_text"]
