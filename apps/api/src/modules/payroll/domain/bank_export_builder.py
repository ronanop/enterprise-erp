"""NEFT/bank upload CSV for a payroll run (Phase 6)."""

from __future__ import annotations

import csv
import io
from decimal import Decimal


def _clean_account(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value) if ch.isalnum())


def build_bank_export_csv(rows: list[dict]) -> str:
    """Each row: employee_code, employee_name, account_number, ifsc, bank_name, net_pay."""
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(
        [
            "employee_code",
            "employee_name",
            "account_number",
            "ifsc",
            "bank_name",
            "account_holder",
            "net_pay",
            "payroll_run_line_id",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r.get("employee_code") or "",
                r.get("employee_name") or "",
                _clean_account(r.get("account_number")),
                (r.get("ifsc") or "").upper(),
                r.get("bank_name") or "",
                r.get("account_holder") or "",
                f"{Decimal(str(r.get('net_pay') or 0)):.2f}",
                r.get("payroll_run_line_id") or "",
            ]
        )
    return buf.getvalue()
