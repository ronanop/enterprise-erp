from decimal import Decimal

from modules.payroll.domain.salary_structure_calculator import (
    compute_ctc_split,
    compute_payable_month,
    employee_pf_from_wage,
    tds_for_the_month,
    tds_for_the_year,
)


def test_excel_18000_ctc_split():
    split = compute_ctc_split(
        gross_ctc=Decimal("18000"),
        basic_percent=Decimal("0.60"),
        hra_percent_of_basic=Decimal("0.50"),
        telephone_allowance=Decimal("0"),
        employer_contribution=Decimal("1800"),
    )
    assert split["monthly_ctc"] == Decimal("18000")
    assert split["basic"] == Decimal("10800")
    assert split["hra"] == Decimal("5400")
    assert split["special_allowance"] == Decimal("0")
    assert split["employee_gross"] == Decimal("16200")
    assert split["ctc"] == Decimal("18000")
    assert split["valid"] is True


def test_spec_30000_breakup():
    split = compute_ctc_split(
        gross_ctc=Decimal("30000"),
        employer_contribution=Decimal("0"),
    )
    assert split["basic"] == Decimal("18000")
    assert split["hra"] == Decimal("9000")
    assert split["special_allowance"] == Decimal("3000")
    assert split["employee_gross"] == Decimal("30000")


def test_payable_month_full_days_pf_min_ceiling():
    split = compute_ctc_split(
        gross_ctc=Decimal("18000"),
        employer_contribution=Decimal("1800"),
    )
    month = compute_payable_month(split, edli_admin_amount=Decimal("100"))
    assert month["payable_basic"] == Decimal("10800")
    assert month["pf_wage"] == Decimal("10800")
    # Y = MIN(10800, 25000) × 12% = 1296
    assert month["pf"] == Decimal("1296")
    assert month["edli_admin"] == Decimal("100")
    # EDLI must not be in employee deductions
    assert month["total_deductions"] == month["pf"] + month["esi"] + month["tds_month"]
    assert month["net"] == month["gross"] - month["total_deductions"]
    assert month["employer_cost"] == Decimal("1800") + Decimal("100") + month["employer_esi"]


def test_payable_special_prorates_under_lop():
    split = compute_ctc_split(
        gross_ctc=Decimal("30000"),
        employer_contribution=Decimal("0"),
    )
    month = compute_payable_month(
        split,
        total_days=Decimal("30"),
        payable_days=Decimal("29"),
        edli_admin_amount=Decimal("0"),
    )
    assert month["payable_basic"] == Decimal("17400")
    assert month["payable_hra"] == Decimal("8700")
    assert month["payable_special"] == Decimal("2900")
    assert month["gross"] == Decimal("29000")


def test_pf_ceiling_25000():
    assert employee_pf_from_wage(Decimal("30000")) == Decimal("3000")
    assert employee_pf_from_wage(Decimal("21000")) == Decimal("2520")


def test_tds_uses_ctc_times_12_like_excel_ae():
    split = compute_ctc_split(
        gross_ctc=Decimal("18000"),
        employer_contribution=Decimal("1800"),
    )
    month = compute_payable_month(split)
    assert month["annual_salary"] == Decimal("18000") * 12
    assert tds_for_the_year(month["annual_salary"]) == Decimal("0")
    assert tds_for_the_month(month["annual_salary"]) == Decimal("0")


def test_excel_row_200000_matches_sheet():
    split = compute_ctc_split(
        gross_ctc=Decimal("200000"),
        employer_contribution=Decimal("3000"),
    )
    assert split["basic"] == Decimal("120000")
    assert split["hra"] == Decimal("60000")
    assert split["special_allowance"] == Decimal("17000")
    month = compute_payable_month(split, edli_admin_amount=Decimal("0"))
    assert month["gross"] == Decimal("197000")
    assert month["pf"] == Decimal("3000")
    assert month["esi"] == Decimal("0")
    assert month["annual_salary"] == Decimal("2400000")
    assert month["tds_year"] == Decimal("292500")
    assert month["tds_month"] == Decimal("24375")
    assert month["total_deductions"] == Decimal("27375")
    assert month["net"] == Decimal("169625")
