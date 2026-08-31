"""Locked payroll policy definitions (Phase 0).

Calculation engines in later phases must read company policy from PayPayrollPolicy
(or these defaults) rather than hard-coded constants.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, TypedDict

from modules.payroll.domain.enums import (
    LeaveBalanceCreditTiming,
    NetPayFormula,
    PayrollCycleType,
    PayrollPeriodDayDenominator,
    PfDeductionMode,
    SalaryProrationMode,
)


class AttendancePayRules(TypedDict, total=False):
    """How attendance statuses affect paid vs LOP days (payroll cycle only)."""

    lop_attendance_statuses: list[str]
    half_lop_attendance_statuses: list[str]
    paid_attendance_statuses: list[str]
    lop_from_unpaid_leave_when_no_attendance_row: bool


DEFAULT_ATTENDANCE_PAY_RULES: AttendancePayRules = {
    "lop_attendance_statuses": ["absent"],
    "half_lop_attendance_statuses": ["half_day"],
    "paid_attendance_statuses": [
        "present",
        "work_from_home",
        "holiday",
        "week_off",
        "on_duty",
        "late",
        "miss_punch",
    ],
    "lop_from_unpaid_leave_when_no_attendance_row": True,
}


def default_company_payroll_policy_fields() -> dict[str, Any]:
    """TechBank / standard package: 20–20 pay, calendar leave, 60/50 split, fixed PF."""
    return {
        "policy_code": "DEFAULT",
        "policy_name": "Standard monthly payroll (20th–20th)",
        "status": "active",
        "payroll_cycle_type": PayrollCycleType.DAY_20_TO_20.value,
        "payroll_cycle_start_day": 20,
        "leave_cycle_type": PayrollCycleType.CALENDAR_MONTH.value,
        "leave_balance_credit_timing": LeaveBalanceCreditTiming.AFTER_CALENDAR_MONTH_END.value,
        "salary_proration_mode": SalaryProrationMode.PER_DAY_X_OVER_N.value,
        "period_day_denominator": PayrollPeriodDayDenominator.SHIFT_SCHEDULED_DAYS.value,
        "lop_source": "attendance",
        "basic_percent": Decimal("0.6000"),
        "hra_percent_of_basic": Decimal("0.5000"),
        "pf_mode": PfDeductionMode.FIXED_SPLIT.value,
        "pf_employee_amount": Decimal("1800.0000"),
        "pf_employer_amount": Decimal("1900.0000"),
        "pf_total_amount": Decimal("3700.0000"),
        "net_pay_formula": NetPayFormula.GROSS_MINUS_FIXED_PF_TOTAL.value,
        "attendance_rules_json": dict(DEFAULT_ATTENDANCE_PAY_RULES),
        "notes": (
            "Gross X: Basic=60%×X, HRA=50%×Basic, Special=remainder. "
            "Payable gross = X×(paid_days/N) with N from shift schedule in 20–20 period. "
            "Net = payable_gross − fixed PF total (3700). Leave balance credits on calendar month end."
        ),
    }


def merge_attendance_rules(rules: dict | None) -> AttendancePayRules:
    base: dict[str, Any] = dict(DEFAULT_ATTENDANCE_PAY_RULES)
    if rules:
        base.update(rules)
    return base  # type: ignore[return-value]
