"""HR report service — summary + CSV/PDF exports (stdlib only)."""

from __future__ import annotations

import csv
import io
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrAttendance, HrEmployment, HrLeaveRequest, HrSeparation
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.leave_request_repository import LeaveRequestRepository
from modules.hr.repository.separation_repository import SeparationRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.master_data.models.employee import MasterEmployee

REPORT_TYPES = {
    "attendance",
    "leave",
    "headcount",
    "late",
    "overtime",
    "probation",
    "joining",
    "exit",
    "attrition",
}


def _csv_bytes(headers: list[str], rows: list[list]) -> bytes:
    buf = io.StringIO()
    buf.write("\ufeff")  # Excel-friendly UTF-8 BOM
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _simple_pdf(title: str, lines: list[str]) -> bytes:
    """Minimal single-page PDF text document (no external deps)."""
    content_lines = [f"BT /F1 14 Tf 50 780 Td ({_pdf_escape(title)}) Tj ET"]
    y = 750
    for line in lines[:40]:
        content_lines.append(f"BT /F1 10 Tf 50 {y} Td ({_pdf_escape(line[:110])}) Tj ET")
        y -= 14
        if y < 50:
            break
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")
    objects: list[bytes] = []
    objects.append(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    objects.append(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n")
    objects.append(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    )
    objects.append(
        f"4 0 obj<< /Length {len(stream)} >>stream\n".encode() + stream + b"\nendstream\nendobj\n"
    )
    objects.append(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(offsets)}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)


class HRReportService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = HrScopeValidator(db)
        self._attendance = AttendanceRepository(db)
        self._leave = LeaveRequestRepository(db)
        self._separation = SeparationRepository(db)

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        attendance = self._attendance.list_rows(ctx, cid)
        leaves = self._leave.list_rows(ctx, cid)
        separations = self._separation.list_rows(ctx, cid)
        return {
            "company_id": cid,
            "attendance_count": len(attendance),
            "leave_request_count": len(leaves),
            "approved_leave_count": sum(1 for r in leaves if r.status == "approved"),
            "separation_count": len(separations),
            "completed_separation_count": sum(1 for r in separations if r.status == "completed"),
        }

    def _dataset(self, ctx: TenantContext, report_type: str, company_id: UUID | None) -> tuple[list[str], list[list], str]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if report_type not in REPORT_TYPES:
            raise ValueError(f"Unknown report type '{report_type}'")

        if report_type == "attendance":
            rows = self._attendance.list_rows(ctx, cid)
            headers = ["employee_id", "date", "status", "check_in", "check_out", "late_minutes", "ot_minutes", "early_leave"]
            data = [
                [
                    str(r.employee_id),
                    str(r.attendance_date),
                    r.attendance_status,
                    str(r.check_in_at or ""),
                    str(r.check_out_at or ""),
                    r.late_minutes or 0,
                    r.overtime_minutes or 0,
                    getattr(r, "early_leave_minutes", None) or 0,
                ]
                for r in rows
            ]
            return headers, data, "Attendance Report"

        if report_type == "leave":
            rows = self._leave.list_rows(ctx, cid)
            headers = ["document", "employee_id", "start", "end", "days", "status"]
            data = [
                [
                    r.document_number,
                    str(r.employee_id),
                    str(r.start_date),
                    str(r.end_date),
                    str(r.days_count),
                    r.status,
                ]
                for r in rows
            ]
            return headers, data, "Leave Report"

        if report_type == "late":
            rows = [
                r
                for r in self._attendance.list_rows(ctx, cid)
                if r.attendance_status == "late" or (r.late_minutes or 0) > 0
            ]
            headers = ["employee_id", "date", "late_minutes", "status"]
            data = [[str(r.employee_id), str(r.attendance_date), r.late_minutes or 0, r.attendance_status] for r in rows]
            return headers, data, "Late Coming Report"

        if report_type == "overtime":
            rows = [r for r in self._attendance.list_rows(ctx, cid) if (r.overtime_minutes or 0) > 0]
            headers = ["employee_id", "date", "overtime_minutes"]
            data = [[str(r.employee_id), str(r.attendance_date), r.overtime_minutes or 0] for r in rows]
            return headers, data, "Overtime Report"

        employments = list(
            self._db.scalars(
                select(HrEmployment).where(
                    HrEmployment.company_id == cid,
                    HrEmployment.is_deleted.is_(False),
                )
            ).all()
        )

        if report_type == "headcount":
            headers = ["employee_id", "employment_type", "status", "date_of_joining"]
            data = [
                [str(r.employee_id), r.employment_type, r.status, str(r.date_of_joining)]
                for r in employments
                if r.status in {"active", "probation", "confirmed", "notice_period"}
            ]
            return headers, data, "Headcount Report"

        if report_type == "probation":
            headers = ["employee_id", "probation_start", "probation_end", "status"]
            data = [
                [
                    str(r.employee_id),
                    str(r.probation_start_date or ""),
                    str(r.probation_end_date or ""),
                    r.status,
                ]
                for r in employments
                if r.status == "probation"
            ]
            return headers, data, "Probation Report"

        if report_type == "joining":
            headers = ["employee_id", "date_of_joining", "employment_type", "status"]
            data = [
                [str(r.employee_id), str(r.date_of_joining), r.employment_type, r.status]
                for r in employments
            ]
            return headers, data, "Joining Report"

        if report_type in {"exit", "attrition"}:
            seps = self._separation.list_rows(ctx, cid)
            headers = ["document", "employee_id", "type", "lwd", "status", "fnf_status"]
            data = [
                [
                    r.document_number,
                    str(r.employee_id),
                    r.separation_type,
                    str(r.approved_last_working_date or r.requested_last_working_date),
                    r.status,
                    getattr(r, "fnf_status", "") or "",
                ]
                for r in seps
            ]
            return headers, data, "Exit / Attrition Report"

        return [], [], report_type

    def export(
        self,
        ctx: TenantContext,
        *,
        report_type: str,
        fmt: str = "csv",
        company_id: UUID | None = None,
    ) -> tuple[bytes, str, str]:
        headers, rows, title = self._dataset(ctx, report_type, company_id)
        stamp = date.today().isoformat()
        if fmt == "pdf":
            lines = [", ".join(headers)] + [", ".join(str(c) for c in row) for row in rows]
            payload = _simple_pdf(title, lines or ["(no rows)"])
            return payload, f"{report_type}_{stamp}.pdf", "application/pdf"
        payload = _csv_bytes(headers, rows)
        return payload, f"{report_type}_{stamp}.csv", "text/csv; charset=utf-8"
