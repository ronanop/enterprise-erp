from decimal import Decimal

from modules.payroll.domain.salary_structure_calculator import (
    compute_ctc_split,
    compute_payable_month,
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
    assert split["ctc"] == Decimal("18000")


def test_payable_month_full_days_pf_ceiling():
    split = compute_ctc_split(
        gross_ctc=Decimal("18000"),
        employer_contribution=Decimal("1800"),
    )
    month = compute_payable_month(split)
    assert month["payable_basic"] == Decimal("10800")
    assert month["pf_wage"] == Decimal("10800")
    assert month["pf"] == Decimal("1296")  # 10800 * 12% because wage < 15000
    assert month["edli_admin"] == Decimal("100")


def test_tds_year_below_rebate():
    annual = Decimal("18000") * 12
    assert tds_for_the_year(annual) == Decimal("0")
    assert tds_for_the_month(annual) == Decimal("0")
