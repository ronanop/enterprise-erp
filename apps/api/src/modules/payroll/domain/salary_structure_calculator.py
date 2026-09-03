"""Salary structure math aligned to Payroll Calculator.xlsx (Gross CTC → CTC split)."""

from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

_RUPEE = Decimal("1")
_MONEY = Decimal("0.01")


def _d(value: object) -> Decimal:
    return Decimal(str(value or 0))


def rupee(value: Decimal) -> Decimal:
    return value.quantize(_RUPEE, rounding=ROUND_HALF_UP)


def money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY, rounding=ROUND_HALF_UP)


def round_up_rupee(value: Decimal) -> Decimal:
    return value.to_integral_value(rounding=ROUND_CEILING)


def compute_ctc_split(
    *,
    gross_ctc: Decimal,
    basic_percent: Decimal = Decimal("0.60"),
    hra_percent_of_basic: Decimal = Decimal("0.50"),
    telephone_allowance: Decimal = Decimal("0"),
    employer_contribution: Decimal = Decimal("1800"),
) -> dict[str, Decimal]:
    """Excel G–N: Monthly CTC = Gross CTC; Special is residual; CTC = SUM(I:M)."""
    monthly = rupee(_d(gross_ctc))
    basic = rupee(monthly * _d(basic_percent))
    hra = rupee(basic * _d(hra_percent_of_basic))
    telephone = rupee(_d(telephone_allowance))
    employer = rupee(_d(employer_contribution))
    special = rupee(monthly - basic - hra - employer - telephone)
    ctc = rupee(basic + hra + special + telephone + employer)
    return {
        "monthly_ctc": monthly,
        "basic": basic,
        "hra": hra,
        "special_allowance": special,
        "telephone_allowance": telephone,
        "employer_contribution": employer,
        "ctc": ctc,
        "difference": rupee(ctc - monthly),
    }


def compute_payable_month(
    split: dict[str, Decimal],
    *,
    total_days: Decimal = Decimal("30"),
    payable_days: Decimal = Decimal("30"),
    advance_arrear: Decimal = Decimal("0"),
    pf_percent: Decimal = Decimal("0.12"),
    pf_wage_ceiling: Decimal = Decimal("15000"),
    pf_fixed_ceiling: Decimal = Decimal("1800"),
    edli_admin_amount: Decimal = Decimal("100"),
    esi_percent: Decimal = Decimal("0.0075"),
    esi_monthly_ceiling: Decimal = Decimal("21000"),
) -> dict[str, Decimal]:
    """Excel O–AD for a sample attendance month (does not post payroll)."""
    o = _d(total_days) or Decimal("1")
    q = _d(payable_days)
    factor = q / o
    basic_p = rupee(split["basic"] * factor)
    hra_p = rupee(split["hra"] * factor)
    tel_p = rupee(split["telephone_allowance"] * factor)
    special_p = rupee(split["special_allowance"] * factor)
    advance = rupee(_d(advance_arrear))
    gross = rupee(basic_p + hra_p + special_p + tel_p + advance)
    pf_wage = rupee(basic_p + special_p)
    pf = rupee(pf_wage * _d(pf_percent)) if pf_wage < _d(pf_wage_ceiling) else rupee(_d(pf_fixed_ceiling))
    edli = rupee(_d(edli_admin_amount))
    annualised_gross = rupee((gross - advance) * o / (q or Decimal("1")))
    esi = rupee((gross - advance) * _d(esi_percent)) if annualised_gross < _d(esi_monthly_ceiling) else Decimal("0")
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
        "annualised_gross_for_esi": annualised_gross,
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


def tds_for_the_month(annual_salary: Decimal) -> Decimal:
    """Excel AH2 = ROUNDUP(AG2 / 12, 0)."""
    yearly = tds_for_the_year(annual_salary)
    return round_up_rupee(yearly / Decimal("12"))
