"""NEFT/bank upload CSV for a payroll run (Phase 6)."""

from __future__ import annotations

import csv
import io
from decimal import Decimal


def _clean_account(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value) if ch.isalnum())


def _csv_cell(value: object) -> str:
    text = "" if value is None else str(value)
    if text[:1] in {"=", "+", "-", "@", "\t", "\r"}:
        return f"'{text}"
    return text


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
                _csv_cell(r.get("employee_code") or ""),
                _csv_cell(r.get("employee_name") or ""),
                _csv_cell(_clean_account(r.get("account_number"))),
                _csv_cell((r.get("ifsc") or "").upper()),
                _csv_cell(r.get("bank_name") or ""),
                _csv_cell(r.get("account_holder") or ""),
                _csv_cell(f"{Decimal(str(r.get('net_pay') or 0)):.2f}"),
                _csv_cell(r.get("payroll_run_line_id") or ""),
            ]
        )
    return buf.getvalue()
