"""NEFT/bank upload CSV for a payroll run (Phase 6)."""

from __future__ import annotations

from decimal import Decimal


def _clean_account(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value) if ch.isalnum())


def _csv_cell(value: object) -> str:
    """Neutralize spreadsheet formula injection (CWE-1236)."""
    text = "" if value is None else str(value)
    if text[:1] in {"=", "+", "-", "@", "\t", "\r"}:
        return f"'{text}"
    return text


def _csv_escape_field(value: object) -> str:
    text = _csv_cell(value).replace("\r\n", "\n").replace("\r", "\n")
    if any(ch in text for ch in (",", '"', "\n")):
        return '"' + text.replace('"', '""') + '"'
    return text


def build_bank_export_csv(rows: list[dict]) -> str:
    """Each row: employee_code, employee_name, account_number, ifsc, bank_name, net_pay."""
    headers = [
        "employee_code",
        "employee_name",
        "account_number",
        "ifsc",
        "bank_name",
        "account_holder",
        "net_pay",
        "payroll_run_line_id",
    ]
    lines = [",".join(_csv_escape_field(h) for h in headers)]
    for r in rows:
        lines.append(
            ",".join(
                _csv_escape_field(v)
                for v in (
                    r.get("employee_code") or "",
                    r.get("employee_name") or "",
                    _clean_account(r.get("account_number")),
                    (r.get("ifsc") or "").upper(),
                    r.get("bank_name") or "",
                    r.get("account_holder") or "",
                    f"{Decimal(str(r.get('net_pay') or 0)):.2f}",
                    r.get("payroll_run_line_id") or "",
                )
            )
        )
    return "\n".join(lines) + "\n"
