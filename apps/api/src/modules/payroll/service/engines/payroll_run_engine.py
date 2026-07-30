"""PayrollRun lifecycle engine."""

from decimal import Decimal, ROUND_HALF_UP

from modules.payroll.domain.enums import (
    PayrollRunStatus,
)
from modules.payroll.domain.exceptions import (
    InvalidPayrollRunState,
)
from modules.payroll.service.engines.statutory_contribution_engine import (
    StatutoryContributionEngine,
)

_Q = Decimal("0.0001")
_STANDARD_DAYS = Decimal("30")
_BASIC_RATE = Decimal("0.40")
_HRA_RATE = Decimal("0.20")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


class PayrollRunEngine:
    def __init__(self) -> None:
        self._statutory = StatutoryContributionEngine()

    def compute_salary_breakdown(
        self,
        gross_amount,
        *,
        paid_days: Decimal | None = None,
        prorate: bool = False,
        overtime_minutes: int | Decimal | None = None,
        bonus_amount: Decimal | int | float | None = None,
        earning_adjustments: Decimal | int | float | None = None,
        deduction_adjustments: Decimal | int | float | None = None,
        adjustment_labels: dict | None = None,
    ) -> dict:
        """Build earnings, statutory deductions, and employer cost from gross."""
        gross = Decimal(str(gross_amount or 0))
        if prorate and paid_days is not None:
            factor = Decimal(str(paid_days)) / _STANDARD_DAYS
            gross = _money(gross * factor)

        basic = _money(gross * _BASIC_RATE)
        hra = _money(gross * _HRA_RATE)
        special_allowance = _money(gross - basic - hra)

        # Shift OT: 1.5× hourly basic (basic / 30 / 8) × overtime hours
        ot_minutes = Decimal(str(overtime_minutes or 0))
        overtime_pay = Decimal("0")
        if ot_minutes > 0:
            hourly_basic = basic / _STANDARD_DAYS / Decimal("8")
            overtime_pay = _money(hourly_basic * Decimal("1.5") * (ot_minutes / Decimal("60")))

        bonus = _money(Decimal(str(bonus_amount or 0)))
        earn_adj = _money(Decimal(str(earning_adjustments or 0)))
        ded_adj = _money(Decimal(str(deduction_adjustments or 0)))

        add_ons = overtime_pay + bonus + earn_adj
        if add_ons:
            gross = _money(gross + add_ons)
            special_allowance = _money(special_allowance + add_ons)

        statutory = self._statutory.compute_pf_esi_pt(gross, basic)
        total_deductions = _money(
            statutory["pf_employee"]
            + statutory["esi_employee"]
            + statutory["professional_tax"]
            + ded_adj
        )
        employer_contribution = _money(
            statutory["pf_employer"] + statutory["esi_employer"]
        )
        net_pay = _money(gross - total_deductions)

        labels = adjustment_labels or {}
        breakdown = {
            "basic": float(basic),
            "hra": float(hra),
            "special_allowance": float(special_allowance),
            "overtime_pay": float(overtime_pay),
            "overtime_minutes": float(ot_minutes),
            "bonus": float(bonus),
            "earning_adjustments": float(earn_adj),
            "deduction_adjustments": float(ded_adj),
            "arrears": float(labels.get("arrears", 0)),
            "incentives": float(labels.get("incentives", 0)),
            "pf_employee": float(statutory["pf_employee"]),
            "esi_employee": float(statutory["esi_employee"]),
            "professional_tax": float(statutory["professional_tax"]),
            "pf_employer": float(statutory["pf_employer"]),
            "esi_employer": float(statutory["esi_employer"]),
            "gross": float(gross),
            "paid_days": float(paid_days if paid_days is not None else _STANDARD_DAYS),
            "prorated": prorate,
        }

        return {
            "gross_earnings": gross,
            "basic": basic,
            "hra": hra,
            "special_allowance": special_allowance,
            "overtime_pay": overtime_pay,
            "bonus": bonus,
            "total_deductions": total_deductions,
            "net_pay": net_pay,
            "employer_contribution": employer_contribution,
            "component_breakdown_json": breakdown,
            **statutory,
        }

    def calculate(self, row) -> None:
        if row.status not in {PayrollRunStatus.DRAFT.value}:
            raise InvalidPayrollRunState("Only draft runs can be calculated")
        row.status = PayrollRunStatus.CALCULATED.value

    def submit(self, row) -> None:
        if row.status != PayrollRunStatus.CALCULATED.value:
            raise InvalidPayrollRunState("Only calculated runs can be submitted")
        row.status = PayrollRunStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != PayrollRunStatus.SUBMITTED.value:
            raise InvalidPayrollRunState("Only submitted runs can be approved")
        row.status = PayrollRunStatus.APPROVED.value

    def mark_posted(self, row) -> None:
        if row.status != PayrollRunStatus.APPROVED.value:
            raise InvalidPayrollRunState("Only approved runs can be posted")
        row.status = PayrollRunStatus.POSTED.value

    def mark_paid(self, row) -> None:
        if row.status != PayrollRunStatus.POSTED.value:
            raise InvalidPayrollRunState("Only posted runs can be marked paid")
        row.status = PayrollRunStatus.PAID.value
