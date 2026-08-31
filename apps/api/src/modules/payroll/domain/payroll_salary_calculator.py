"""Salary component + PF math from company payroll policy (Phase 4)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from modules.payroll.domain.enums import NetPayFormula, PfDeductionMode
from modules.payroll.domain.payroll_policy_spec import default_company_payroll_policy_fields

_Q = Decimal("0.0001")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


def _dec(value) -> Decimal:
    return Decimal(str(value or 0))


def resolve_policy(policy: dict | None) -> dict:
    base = default_company_payroll_policy_fields()
    if not policy:
        return base
    merged = {**base, **{k: v for k, v in policy.items() if v is not None}}
    return merged


def split_earnings(gross: Decimal, policy: dict) -> tuple[Decimal, Decimal, Decimal]:
    g = _money(gross)
    basic_pct = _dec(policy.get("basic_percent", "0.6"))
    hra_on_basic = _dec(policy.get("hra_percent_of_basic", "0.5"))
    basic = _money(g * basic_pct)
    hra = _money(basic * hra_on_basic)
    special = _money(g - basic - hra)
    return basic, hra, special


def compute_pf(policy: dict, *, gross: Decimal, basic: Decimal) -> dict:
    mode = policy.get("pf_mode") or PfDeductionMode.FIXED_SPLIT.value
    if mode == PfDeductionMode.STATUTORY_PERCENT.value:
        from modules.payroll.service.engines.statutory_contribution_engine import (
            StatutoryContributionEngine,
        )

        return StatutoryContributionEngine().compute_pf_esi_pt(gross, basic)

    ee = _money(_dec(policy.get("pf_employee_amount")))
    er = _money(_dec(policy.get("pf_employer_amount")))
    total = _money(_dec(policy.get("pf_total_amount")))
    if mode == PfDeductionMode.FIXED_TOTAL.value:
        if total <= 0:
            total = ee + er
        if ee <= 0 and er <= 0:
            ee = total
            er = Decimal("0.0000")
    elif ee + er <= 0 and total > 0:
        ee = total
        er = Decimal("0.0000")

    return {
        "pf_employee": ee,
        "pf_employer": er,
        "pf_total": _money(ee + er),
        "esi_employee": Decimal("0.0000"),
        "esi_employer": Decimal("0.0000"),
        "professional_tax": Decimal("0.0000"),
        "esi_applies": False,
    }


def compute_net_and_deductions(
    gross: Decimal,
    statutory: dict,
    policy: dict,
    *,
    deduction_adjustments: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    """Returns (total_deductions, net_pay, employer_contribution)."""
    ee = _money(_dec(statutory.get("pf_employee")))
    er = _money(_dec(statutory.get("pf_employer")))
    esi_ee = _money(_dec(statutory.get("esi_employee")))
    pt = _money(_dec(statutory.get("professional_tax")))
    ded_adj = _money(deduction_adjustments)

    formula = policy.get("net_pay_formula") or NetPayFormula.GROSS_MINUS_FIXED_PF_TOTAL.value
    pf_mode = policy.get("pf_mode") or PfDeductionMode.FIXED_SPLIT.value

    if pf_mode in {PfDeductionMode.FIXED_SPLIT.value, PfDeductionMode.FIXED_TOTAL.value}:
        if formula == NetPayFormula.GROSS_MINUS_FIXED_PF_TOTAL.value:
            pf_deduct = _money(ee + er)
            total_deductions = _money(pf_deduct + ded_adj)
            net_pay = _money(gross - total_deductions)
            employer_contribution = er
            return total_deductions, net_pay, employer_contribution

        total_deductions = _money(ee + esi_ee + pt + ded_adj)
        net_pay = _money(gross - total_deductions)
        employer_contribution = _money(er + _dec(statutory.get("esi_employer")))
        return total_deductions, net_pay, employer_contribution

    total_deductions = _money(ee + esi_ee + pt + ded_adj)
    net_pay = _money(gross - total_deductions)
    employer_contribution = _money(er + _dec(statutory.get("esi_employer")))
    return total_deductions, net_pay, employer_contribution
