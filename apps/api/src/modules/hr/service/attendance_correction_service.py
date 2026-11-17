"""Attendance correction request/approve workflow."""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.exceptions import InvalidAttendanceState
from modules.hr.repository.attendance_correction_repository import AttendanceCorrectionRepository
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.service.engines import AttendanceEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator

_VALID_FIELDS = {"check_in", "check_out", "attendance_status"}
_VALID_STATUS = {
    "draft",
    "submitted",
    "manager_approved",
    "approved",
    "rejected",
    "cancelled",
}


class AttendanceCorrectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AttendanceCorrectionRepository(db)
        self._attendance = AttendanceRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._engine = AttendanceEngine()
        self._audit = PlatformAuditFacade(db)

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

        # Cap open requests only (manager still has pending items).
        year_count = 0
        for corr in self._repo.list_rows(ctx, cid):
            if corr.employee_id != employee_id:
                continue
            if corr.attendance_date.year != attendance_date.year:
                continue
            if corr.status in {"draft", "submitted"}:
                year_count += 1
        if year_count >= 5:
            raise AppException(
                "You already have 5 open regularization requests this year. "
                "Wait for your manager to action them before submitting more."
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
            from modules.master_data.models.employee import MasterEmployee

            is_miss = (
                row.field_name == "attendance_status"
                and str(row.new_value or "").lower()
                in {"miss_punch", "miss-punch", "misspunch"}
            ) or "miss" in str(row.reason or "").lower()
            emp = self._db.get(MasterEmployee, row.employee_id)
            emp_name = (
                f"{emp.first_name} {emp.last_name}".strip()
                if emp is not None
                else "Team member"
            )
            # Employee confirmation (do not CC manager here — dedicated manager notify below).
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.miss_punch"
                if is_miss
                else "hr.attendance_correction_submitted",
                template_name="Miss Punch Request"
                if is_miss
                else "Attendance Correction Submitted",
                event_type="hr.miss_punch"
                if is_miss
                else "hr.attendance_correction_submitted",
                title="Miss punch request submitted"
                if is_miss
                else "Attendance correction submitted",
                body=(
                    f"Your regularization for {row.attendance_date} "
                    f"({row.field_name}) was sent to your manager."
                ),
                kind="miss_punch" if is_miss else "attendance",
                extra={"correction_id": str(row.id), "href": "/attendance/correction"},
                cc_reporting_manager=False,
            )
            # Manager ESS inbox
            mgr_id = getattr(emp, "reporting_manager_id", None) if emp else None
            if mgr_id:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=mgr_id,
                    template_code="hr.attendance_correction_manager",
                    template_name="Team Attendance Regularization",
                    event_type="hr.attendance_correction_manager",
                    title=f"Regularization from {emp_name}",
                    body=(
                        f"{emp_name} requested attendance regularization for "
                        f"{row.attendance_date} ({row.field_name}). Open Team Approvals."
                    ),
                    kind="attendance",
                    extra={
                        "correction_id": str(row.id),
                        "href": "/approvals",
                        "employee_id": str(row.employee_id),
                    },
                    cc_reporting_manager=False,
                )
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "Failed to notify on attendance correction submit id=%s", row_id
            )
        return updated

    def manager_approve(
        self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None
    ):
        """Manager step — pending HR final approval (no attendance apply yet)."""
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState(
                "Only submitted corrections can be manager-approved"
            )
        updated = self._repo.update(
            ctx,
            row_id,
            status="manager_approved",
            manager_approver_id=approver_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance_correction",
            entity_id=row_id,
            operation="manager_approve",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import (
                notify_employee,
                notify_users_with_permission,
            )

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.attendance_correction_manager_approved",
                template_name="Attendance Correction Manager Approved",
                event_type="hr.attendance_correction_manager_approved",
                title="Regularization approved by manager",
                body=(
                    f"Your correction for {row.attendance_date} was approved by "
                    "your manager and is pending HR."
                ),
                kind="attendance",
                cc_reporting_manager=False,
                extra={"correction_id": str(row.id), "href": "/attendance/correction"},
            )
            exclude: set[UUID] = set()
            if ctx.user_id:
                exclude.add(ctx.user_id)
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.attendance:update",
                template_code="hr.attendance_correction_pending_hr",
                template_name="Regularization Pending HR",
                event_type="hr.attendance_correction_pending_hr",
                title="Regularization pending HR approval",
                body=(
                    f"Attendance regularization for {row.attendance_date} was "
                    "manager-approved and needs HR final approval."
                ),
                kind="attendance",
                extra={
                    "href": "/hr/ess-inbox",
                    "correction_id": str(row.id),
                },
                exclude_user_ids=exclude,
            )
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "Failed to notify on correction manager_approve id=%s", row_id
            )
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID):
        """HR final approval — applies attendance change."""
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidAttendanceState(
                "Correction must be submitted or manager-approved for HR approval"
            )

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
                body=f"Your correction for {row.attendance_date} was approved by HR.",
                kind="attendance",
                extra={"correction_id": str(row.id), "href": "/attendance"},
            )
        except Exception:
            pass
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidAttendanceState(
                "Only submitted/manager-approved corrections can be rejected"
            )
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
                extra={"correction_id": str(row.id), "href": "/attendance"},
            )
        except Exception:
            pass
        return updated

    def cancel(self, ctx: TenantContext, row_id: UUID):
        """Employee revoke — only while still awaiting manager action."""
        row = self.get(ctx, row_id)
        if row.status not in {"draft", "submitted"}:
            raise InvalidAttendanceState(
                "Only draft or submitted corrections can be revoked"
            )
        updated = self._repo.update(
            ctx,
            row_id,
            status="cancelled",
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance_correction",
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        try:
            from modules.hr.service.hr_notify import notify_employee
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, row.employee_id)
            emp_name = (
                f"{emp.first_name} {emp.last_name}".strip()
                if emp is not None
                else "Employee"
            )
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.attendance_correction_cancelled",
                template_name="Attendance Correction Revoked",
                event_type="hr.attendance_correction_cancelled",
                title="Regularization revoked",
                body=f"You revoked the correction for {row.attendance_date}.",
                kind="attendance",
                extra={"correction_id": str(row.id), "href": "/attendance/correction"},
                cc_reporting_manager=False,
            )
            mgr_id = getattr(emp, "reporting_manager_id", None) if emp else None
            if mgr_id:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=mgr_id,
                    template_code="hr.attendance_correction_cancelled_manager",
                    template_name="Team Regularization Revoked",
                    event_type="hr.attendance_correction_cancelled_manager",
                    title=f"Regularization revoked by {emp_name}",
                    body=(
                        f"{emp_name} revoked the regularization for "
                        f"{row.attendance_date}. No action needed."
                    ),
                    kind="attendance",
                    extra={
                        "correction_id": str(row.id),
                        "href": "/approvals",
                        "employee_id": str(row.employee_id),
                    },
                    cc_reporting_manager=False,
                )
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "Failed to notify on attendance correction cancel id=%s", row_id
            )
        return updated
