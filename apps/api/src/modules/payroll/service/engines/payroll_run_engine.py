"""PayrollRun lifecycle engine."""

from decimal import Decimal, ROUND_HALF_UP

from modules.payroll.domain.enums import PayrollRunStatus
from modules.payroll.domain.exceptions import InvalidPayrollRunState
from modules.payroll.domain.payroll_salary_calculator import (
    compute_net_and_deductions,
    compute_pf,
    resolve_policy,
    split_earnings,
)

_Q = Decimal("0.0001")
_STANDARD_DAYS = Decimal("30")
_LEGACY_BASIC_RATE = Decimal("0.40")
_LEGACY_HRA_RATE = Decimal("0.20")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


class PayrollRunEngine:
    def compute_salary_breakdown(
        self,
        gross_amount,
        *,
        paid_days: Decimal | None = None,
        period_days: Decimal | None = None,
        prorate: bool = False,
        overtime_minutes: int | Decimal | None = None,
        bonus_amount: Decimal | int | float | None = None,
        earning_adjustments: Decimal | int | float | None = None,
        deduction_adjustments: Decimal | int | float | None = None,
        adjustment_labels: dict | None = None,
        policy: dict | None = None,
    ) -> dict:
        """Build earnings, deductions, and net from gross and company policy."""
        resolved = resolve_policy(policy)
        use_legacy = policy is None

        gross = Decimal(str(gross_amount or 0))
        denom = Decimal(str(period_days if period_days is not None else _STANDARD_DAYS))
        if denom <= 0:
            denom = _STANDARD_DAYS
        if prorate and paid_days is not None:
            factor = Decimal(str(paid_days)) / denom
            gross = _money(gross * factor)

        if use_legacy:
            basic = _money(gross * _LEGACY_BASIC_RATE)
            hra = _money(gross * _LEGACY_HRA_RATE)
            special_allowance = _money(gross - basic - hra)
        else:
            basic, hra, special_allowance = split_earnings(gross, resolved)

        ot_minutes = Decimal(str(overtime_minutes or 0))
        overtime_pay = Decimal("0")
        if ot_minutes > 0:
            hourly_basic = basic / denom / Decimal("8")
            overtime_pay = _money(hourly_basic * Decimal("1.5") * (ot_minutes / Decimal("60")))

        bonus = _money(Decimal(str(bonus_amount or 0)))
        earn_adj = _money(Decimal(str(earning_adjustments or 0)))
        ded_adj = _money(Decimal(str(deduction_adjustments or 0)))

        add_ons = overtime_pay + bonus + earn_adj
        if add_ons:
            gross = _money(gross + add_ons)
            if use_legacy:
                basic = _money(gross * _LEGACY_BASIC_RATE)
                hra = _money(gross * _LEGACY_HRA_RATE)
                special_allowance = _money(gross - basic - hra)
            else:
                basic, hra, special_allowance = split_earnings(gross, resolved)

        if use_legacy:
            from modules.payroll.service.engines.statutory_contribution_engine import (
                StatutoryContributionEngine,
            )

            statutory = StatutoryContributionEngine().compute_pf_esi_pt(gross, basic)
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
        else:
            statutory = compute_pf(resolved, gross=gross, basic=basic)
            total_deductions, net_pay, employer_contribution = compute_net_and_deductions(
                gross, statutory, resolved, deduction_adjustments=ded_adj
            )

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
            "pf_employer": float(statutory["pf_employer"]),
            "pf_total": float(statutory.get("pf_total", statutory["pf_employee"] + statutory["pf_employer"])),
            "esi_employee": float(statutory.get("esi_employee", 0)),
            "professional_tax": float(statutory.get("professional_tax", 0)),
            "esi_employer": float(statutory.get("esi_employer", 0)),
            "gross": float(gross),
            "paid_days": float(paid_days if paid_days is not None else denom),
            "period_days": float(denom),
            "prorated": prorate,
            "net_pay_formula": resolved.get("net_pay_formula"),
            "pf_mode": resolved.get("pf_mode"),
            "policy_source": policy.get("source") if policy else "legacy",
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
