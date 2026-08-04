"""Attendance correction request/approve workflow."""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.exceptions import InvalidAttendanceState
from modules.hr.repository.attendance_correction_repository import AttendanceCorrectionRepository
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.service.engines import AttendanceEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator

_VALID_FIELDS = {"check_in", "check_out", "attendance_status"}
_VALID_STATUS = {"draft", "submitted", "approved", "rejected"}


class AttendanceCorrectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AttendanceCorrectionRepository(db)
        self._attendance = AttendanceRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._engine = AttendanceEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Attendance correction not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        attendance_date: date,
        field_name: str,
        new_value: str,
        company_id: UUID | None = None,
        attendance_id: UUID | None = None,
        old_value: str | None = None,
        reason: str | None = None,
        status: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if field_name not in _VALID_FIELDS:
            raise AppException(f"Invalid field_name '{field_name}'")
        st = status or "draft"
        if st not in _VALID_STATUS:
            raise AppException(f"Invalid status '{st}'")

        # Max 3 regularization requests per employee per calendar year
        year_count = 0
        for corr in self._repo.list_rows(ctx, cid):
            if corr.employee_id != employee_id:
                continue
            if corr.attendance_date.year != attendance_date.year:
                continue
            if corr.status in {"draft", "submitted", "approved"}:
                year_count += 1
        if year_count >= 3:
            raise AppException(
                "Maximum 3 miss-punch / regularization requests allowed per calendar year"
            )

        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            attendance_id=attendance_id,
            attendance_date=attendance_date,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            status=st,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidAttendanceState("Only draft corrections can be submitted")
        updated = self._repo.update(ctx, row_id, status="submitted")
        try:
            from modules.hr.service.hr_notify import notify_employee

            is_miss = (
                row.field_name == "attendance_status"
                and str(row.new_value or "").lower() in {"miss_punch", "miss-punch", "misspunch"}
            ) or "miss" in str(row.reason or "").lower()
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.miss_punch" if is_miss else "hr.attendance_correction_submitted",
                template_name="Miss Punch Request" if is_miss else "Attendance Correction Submitted",
                event_type="hr.miss_punch" if is_miss else "hr.attendance_correction_submitted",
                title="Miss punch request submitted" if is_miss else "Attendance correction submitted",
                body=f"Correction for {row.attendance_date} ({row.field_name}) is pending approval.",
                kind="miss_punch" if is_miss else "attendance",
            )
        except Exception:
            pass
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState("Only submitted corrections can be approved")

        att = None
        if row.attendance_id:
            att = self._attendance.get(ctx, row.attendance_id)
        if att is None:
            # Find by employee + date
            for candidate in self._attendance.list_rows(ctx, row.company_id):
                if (
                    candidate.employee_id == row.employee_id
                    and candidate.attendance_date == row.attendance_date
                ):
                    att = candidate
                    break
        if att is None:
            raise NotFoundException("Attendance record not found for correction")

        self._engine.adjust(att)
        patch: dict = {"status": "adjusted"}
        if row.field_name == "check_in":
            patch["check_in_at"] = datetime.fromisoformat(row.new_value.replace("Z", "+00:00"))
        elif row.field_name == "check_out":
            patch["check_out_at"] = datetime.fromisoformat(row.new_value.replace("Z", "+00:00"))
        elif row.field_name == "attendance_status":
            patch["attendance_status"] = row.new_value

        self._attendance.update(ctx, att.id, **patch)
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
            attendance_id=att.id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance_correction",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.attendance_correction_approved",
                template_name="Attendance Correction Approved",
                event_type="hr.attendance_correction_approved",
                title="Attendance correction approved",
                body=f"Your correction for {row.attendance_date} was approved.",
                kind="attendance",
            )
        except Exception:
            pass
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState("Only submitted corrections can be rejected")
        updated = self._repo.update(
            ctx,
            row_id,
            status="rejected",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance_correction",
            entity_id=row_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.attendance_correction_rejected",
                template_name="Attendance Correction Rejected",
                event_type="hr.attendance_correction_rejected",
                title="Attendance correction rejected",
                body=f"Your correction for {row.attendance_date} was rejected.",
                kind="attendance",
            )
        except Exception:
            pass
        return updated
