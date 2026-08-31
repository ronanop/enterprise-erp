"""Build concise payslip JSON + plain-text export (Phase 5)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any


def _f(value) -> float:
    return float(Decimal(str(value or 0)))


def _inr(value) -> str:
    n = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    return f"₹{n:,.2f}"


def build_payslip_document(
    *,
    period_code: str,
    period_name: str,
    period_start: date,
    period_end: date,
    employee_id: str,
    employee_code: str | None,
    employee_name: str | None,
    payroll_run_id: str,
    payroll_run_line_id: str,
    paid_days: Decimal | float,
    period_days: Decimal | float,
    lop_days: Decimal | float,
    leave_days: Decimal | float,
    gross_earnings: Decimal | float,
    total_deductions: Decimal | float,
    net_pay: Decimal | float,
    employer_contribution: Decimal | float,
    component_breakdown: dict | None,
    day_summary: dict | None,
) -> dict[str, Any]:
    bd = component_breakdown or {}
    day = day_summary or bd.get("day_summary") or {}
    counts = day.get("counts") if isinstance(day, dict) else {}

    earnings = [
        {"code": "basic", "label": "Basic", "amount": _f(bd.get("basic"))},
        {"code": "hra", "label": "HRA", "amount": _f(bd.get("hra"))},
        {"code": "special", "label": "Special Allowance", "amount": _f(bd.get("special_allowance"))},
    ]
    if _f(bd.get("overtime_pay")) > 0:
        earnings.append({"code": "ot", "label": "Overtime", "amount": _f(bd.get("overtime_pay"))})
    if _f(bd.get("bonus")) > 0:
        earnings.append({"code": "bonus", "label": "Bonus", "amount": _f(bd.get("bonus"))})

    pf_total = _f(bd.get("pf_total") or (_f(bd.get("pf_employee")) + _f(bd.get("pf_employer"))))
    deductions = [
        {"code": "pf_employee", "label": "Employee PF", "amount": _f(bd.get("pf_employee"))},
        {"code": "pf_employer", "label": "Employer PF", "amount": _f(bd.get("pf_employer"))},
        {"code": "pf_total", "label": "PF (Total)", "amount": pf_total},
    ]
    if _f(bd.get("esi_employee")) > 0:
        deductions.append({"code": "esi", "label": "ESI", "amount": _f(bd.get("esi_employee"))})
    if _f(bd.get("professional_tax")) > 0:
        deductions.append({"code": "pt", "label": "Professional Tax", "amount": _f(bd.get("professional_tax"))})
    if _f(bd.get("deduction_adjustments")) > 0:
        deductions.append(
            {
                "code": "adj",
                "label": "Other Deductions",
                "amount": _f(bd.get("deduction_adjustments")),
            }
        )

    attendance = {
        "period_days": _f(period_days or bd.get("period_days")),
        "paid_days": _f(paid_days or bd.get("paid_days")),
        "lop_days": _f(lop_days),
        "leave_days": _f(leave_days),
        "scheduled_working": _f(counts.get("scheduled_working") if counts else 0),
        "paid_leave": _f(counts.get("paid_leave") if counts else 0),
        "unpaid_leave": _f(counts.get("unpaid_leave") if counts else 0),
        "present": _f(counts.get("present") if counts else 0),
        "absent": _f(counts.get("absent") if counts else 0),
    }

    doc: dict[str, Any] = {
        "version": 1,
        "period": {
            "code": period_code,
            "name": period_name,
            "start": period_start.isoformat(),
            "end": period_end.isoformat(),
        },
        "employee": {
            "id": employee_id,
            "code": employee_code,
            "name": employee_name,
        },
        "payroll_run_id": payroll_run_id,
        "payroll_run_line_id": payroll_run_line_id,
        "attendance": attendance,
        "earnings": earnings,
        "deductions": deductions,
        "summary": {
            "gross": _f(gross_earnings or bd.get("gross")),
            "total_deductions": _f(total_deductions),
            "net_pay": _f(net_pay),
            "employer_contribution": _f(employer_contribution),
            "net_pay_formula": bd.get("net_pay_formula"),
            "pf_mode": bd.get("pf_mode"),
        },
        "component_breakdown": bd,
    }
    doc["export_text"] = format_payslip_text(doc)
    return doc


def format_payslip_text(doc: dict[str, Any]) -> str:
    period = doc.get("period") or {}
    emp = doc.get("employee") or {}
    att = doc.get("attendance") or {}
    summary = doc.get("summary") or {}
    lines = [
        "=" * 42,
        "           EMPLOYEE PAYSLIP",
        "=" * 42,
        f"Period:   {period.get('name') or period.get('code')}",
        f"Dates:    {period.get('start')} to {period.get('end')}",
        f"Employee: {emp.get('name') or '—'} ({emp.get('code') or emp.get('id')})",
        "-" * 42,
        "ATTENDANCE (payroll cycle)",
        f"  Scheduled / N     {att.get('period_days', 0)}",
        f"  Paid days         {att.get('paid_days', 0)}",
        f"  LOP days          {att.get('lop_days', 0)}",
        f"  Leave (requests)  {att.get('leave_days', 0)}",
        f"  Paid leave        {att.get('paid_leave', 0)}",
        f"  Unpaid leave      {att.get('unpaid_leave', 0)}",
        "-" * 42,
        "EARNINGS",
    ]
    for row in doc.get("earnings") or []:
        lines.append(f"  {str(row.get('label', '')).ljust(22)} {_inr(row.get('amount'))}")
    lines.append(f"  {'Gross'.ljust(22)} {_inr(summary.get('gross'))}")
    lines.extend(["-" * 42, "DEDUCTIONS"])
    for row in doc.get("deductions") or []:
        if row.get("code") == "pf_total":
            continue
        lines.append(f"  {str(row.get('label', '')).ljust(22)} {_inr(row.get('amount'))}")
    lines.append(f"  {'PF Total'.ljust(22)} {_inr(summary.get('total_deductions'))}")
    lines.extend(
        [
            "-" * 42,
            f"  {'NET PAY'.ljust(22)} {_inr(summary.get('net_pay'))}",
            "-" * 42,
            f"  Employer cost (PF etc.) {_inr(summary.get('employer_contribution'))}",
            "=" * 42,
        ]
    )
    return "\n".join(lines)
