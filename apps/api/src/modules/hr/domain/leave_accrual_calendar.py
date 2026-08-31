"""Leave balance credit uses completed calendar months (1–31), not payroll 20–20."""

from __future__ import annotations

from datetime import date, timedelta


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
    return int(period_yyyymm[:4])
