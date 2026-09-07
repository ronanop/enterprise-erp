"""Leave balance credit uses completed calendar months (1–31), not payroll 20–20.

Leave balances run on a March–March financial year: 1 March through the last day of February.
"""

from __future__ import annotations

from datetime import date, timedelta


def leave_financial_year(on_date: date) -> int:
    """FY start year. 1 Mar 2026–28 Feb 2027 → 2026."""
    return on_date.year if on_date.month >= 3 else on_date.year - 1


def leave_financial_year_label(year: int) -> str:
    return f"{year}–{str(year + 1)[2:]} · 1 Mar–last Feb"


def completed_calendar_month_yyyymm(reference: date | None = None) -> str:
    """``YYYY-MM`` for the last fully ended calendar month relative to ``reference``.

    Examples (cycle_start irrelevant):
    - 2026-03-01 → ``2026-02``
    - 2026-02-15 → ``2026-01`` (February not ended yet)
    - 2026-01-10 → ``2025-12``
    """
    ref = reference or date.today()
    last_day_prev_month = ref.replace(day=1) - timedelta(days=1)
    return last_day_prev_month.strftime("%Y-%m")


def balance_year_for_accrual_period(period_yyyymm: str) -> int:
    year = int(period_yyyymm[:4])
    month = int(period_yyyymm[5:7])
    return leave_financial_year(date(year, month, 1))
