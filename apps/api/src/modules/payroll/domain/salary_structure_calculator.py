"""Salary structure math mapped from Payroll Calculator.xlsx (corrected).

H=G; I=H×basic%; J=I×hra%; K=H−I−J−M−L; N=SUM(I:M)
R/S/U=component×Q/O; T=K×Q/O (not (N×Q/O)−R−S−U−M)
W=R+S+T+U+V; X=R+T; Y=MIN(X,ceiling)×rate
Z=EDLI employer-only; AA=ESI EE; AC=Y+AA+TDS; AD=W−AC
TDS: AE = N×12; AG = annual tax(AE); AH = ROUNDUP(AG/12) (Excel sheet).
"""

from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

_RUPEE = Decimal("1")
_MONEY = Decimal("0.01")

# Sheet Y: IF(X<25000, X*12%, 3000) ≡ MIN(X, 25000)*12%
_DEFAULT_PF_CEILING = Decimal("25000")
_DEFAULT_PF_RATE = Decimal("0.12")
_DEFAULT_ESI_EE = Decimal("0.0075")
_DEFAULT_ESI_ER = Decimal("0.0325")
_DEFAULT_ESI_CEILING = Decimal("21000")


def _d(value: object) -> Decimal:
    return Decimal(str(value or 0))


def rupee(value: Decimal) -> Decimal:
    return value.quantize(_RUPEE, rounding=ROUND_HALF_UP)


def money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY, rounding=ROUND_HALF_UP)


def round_up_rupee(value: Decimal) -> Decimal:
    return value.to_integral_value(rounding=ROUND_CEILING)


def employee_pf_from_wage(
    pf_wage: Decimal,
    *,
    pf_percent: Decimal = _DEFAULT_PF_RATE,
    pf_wage_ceiling: Decimal = _DEFAULT_PF_CEILING,
) -> Decimal:
    """Y = MIN(PF wage, ceiling) × rate."""
    base = max(_d(0), _d(pf_wage))
    ceiling = _d(pf_wage_ceiling)
    capped = min(base, ceiling) if ceiling > 0 else base
    return rupee(capped * _d(pf_percent))


def compute_ctc_split(
    *,
    gross_ctc: Decimal,
    basic_percent: Decimal = Decimal("0.60"),
    hra_percent_of_basic: Decimal = Decimal("0.50"),
    telephone_allowance: Decimal = Decimal("0"),
    employer_contribution: Decimal = Decimal("1800"),
) -> dict[str, Decimal | bool]:
    """Excel G–N: Monthly CTC = Gross CTC; Special is residual; CTC = SUM(I:M)."""
    monthly = rupee(_d(gross_ctc))
    basic = rupee(monthly * _d(basic_percent))
    hra = rupee(basic * _d(hra_percent_of_basic))
    telephone = rupee(_d(telephone_allowance))
    employer = rupee(_d(employer_contribution))
    special_raw = monthly - basic - hra - employer - telephone
    special = rupee(special_raw)
    employee_gross = rupee(basic + hra + special + telephone)
    ctc = rupee(employee_gross + employer)
    return {
        "monthly_ctc": monthly,
        "basic": basic,
        "hra": hra,
        "special_allowance": special,
        "telephone_allowance": telephone,
        "employer_contribution": employer,
        "employee_gross": employee_gross,
        "ctc": ctc,
        "difference": rupee(ctc - monthly),
        "valid": special_raw >= Decimal("-0.5"),
    }


def compute_payable_month(
    split: dict,
    *,
    total_days: Decimal = Decimal("30"),
    payable_days: Decimal = Decimal("30"),
    advance_arrear: Decimal = Decimal("0"),
    pf_percent: Decimal = _DEFAULT_PF_RATE,
    pf_wage_ceiling: Decimal = _DEFAULT_PF_CEILING,
    pf_fixed_ceiling: Decimal = Decimal("3000"),  # noqa: ARG001 — deprecated compat
    edli_admin_amount: Decimal = Decimal("0"),
    esi_percent: Decimal = _DEFAULT_ESI_EE,
    esi_employer_percent: Decimal = _DEFAULT_ESI_ER,
    esi_monthly_ceiling: Decimal = _DEFAULT_ESI_CEILING,
    tds_already_deducted: Decimal = Decimal("0"),
    remaining_months: int = 12,
) -> dict[str, Decimal]:
    """Excel O–AD for a sample attendance month (does not post payroll)."""
    del pf_fixed_ceiling  # PF uses MIN(wage, ceiling)×rate only
    o = _d(total_days) or Decimal("1")
    q = max(_d(0), _d(payable_days))
    factor = q / o
    special_full = max(_d(0), _d(split["special_allowance"]))
    basic_p = rupee(_d(split["basic"]) * factor)
    hra_p = rupee(_d(split["hra"]) * factor)
    tel_p = rupee(_d(split["telephone_allowance"]) * factor)
    special_p = rupee(special_full * factor)
    advance = rupee(_d(advance_arrear))
    gross = rupee(basic_p + hra_p + special_p + tel_p + advance)
    pf_wage = rupee(basic_p + special_p)
    pf = employee_pf_from_wage(pf_wage, pf_percent=pf_percent, pf_wage_ceiling=pf_wage_ceiling)
    edli = rupee(_d(edli_admin_amount))
    earned = max(_d(0), gross - advance)
    annualised_gross = rupee(earned * o / q) if q > 0 else rupee(_d(split.get("employee_gross", 0)))
    esi_applies = annualised_gross < _d(esi_monthly_ceiling)
    esi = rupee(earned * _d(esi_percent)) if esi_applies else Decimal("0")
    employer_esi = rupee(earned * _d(esi_employer_percent)) if esi_applies else Decimal("0")
    # Excel AE = N×12 (full CTC including employer contribution in N)
    annual_salary = rupee(_d(split["ctc"]) * 12)
    tds_year = tds_for_the_year(annual_salary)
    tds_month = tds_for_the_month(
        annual_salary,
        already_deducted=tds_already_deducted,
        remaining_months=remaining_months,
    )
    total_ded = rupee(pf + esi + tds_month)
    net = rupee(gross - total_ded)
    employer_cost = rupee(_d(split["employer_contribution"]) + edli + employer_esi)
    return {
        "payable_basic": basic_p,
        "payable_hra": hra_p,
        "payable_special": special_p,
        "payable_telephone": tel_p,
        "gross": gross,
        "pf_wage": pf_wage,
        "pf": pf,
        "edli_admin": edli,
        "esi": esi,
        "employer_esi": employer_esi,
        "annualised_gross_for_esi": annualised_gross,
        "annual_salary": annual_salary,
        "tds_year": tds_year,
        "tds_month": tds_month,
        "total_deductions": total_ded,
        "net": net,
        "employer_cost": employer_cost,
    }


def tds_for_the_year(annual_salary: Decimal) -> Decimal:
    """Excel AG2 (new-regime style LET: 75k standard deduction, rebate, surcharge, 4% cess)."""
    ni = max(_d(0), _d(annual_salary) - Decimal("75000"))
    base_tax = (
        max(_d(0), ni - Decimal("400000")) * Decimal("0.05")
        + max(_d(0), ni - Decimal("800000")) * Decimal("0.05")
        + max(_d(0), ni - Decimal("1200000")) * Decimal("0.05")
        + max(_d(0), ni - Decimal("1600000")) * Decimal("0.05")
        + max(_d(0), ni - Decimal("2000000")) * Decimal("0.05")
        + max(_d(0), ni - Decimal("2400000")) * Decimal("0.05")
    )
    if ni <= Decimal("1200000"):
        tax_after_rebate = Decimal("0")
    else:
        tax_after_rebate = min(base_tax, ni - Decimal("1200000"))
    if ni > Decimal("10000000"):
        total_before_cess = min(tax_after_rebate * Decimal("1.15"), Decimal("2838000") + (ni - Decimal("10000000")))
    elif ni > Decimal("5000000"):
        total_before_cess = min(tax_after_rebate * Decimal("1.1"), Decimal("1080000") + (ni - Decimal("5000000")))
    else:
        total_before_cess = tax_after_rebate
    return rupee(total_before_cess * Decimal("1.04"))


def tds_for_the_month(
    annual_salary: Decimal,
    *,
    already_deducted: Decimal = Decimal("0"),
    remaining_months: int = 12,
) -> Decimal:
    """Remaining annual tax ÷ remaining months (Excel AH simplified ÷12 when defaults)."""
    yearly = tds_for_the_year(annual_salary)
    remaining = max(_d(0), yearly - _d(already_deducted))
    months = max(1, int(remaining_months or 12))
    return round_up_rupee(remaining / Decimal(months))
