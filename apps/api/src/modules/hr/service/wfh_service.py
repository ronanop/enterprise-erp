"""Work From Home request service - employee → manager → HR."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.exceptions import InvalidAttendanceState
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.wfh_repository import WfhRequestRepository
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.hr_scope_validator import HrScopeValidator

_PORTIONS = {"first_half", "second_half", "full_day"}


class WfhRequestService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = WfhRequestRepository(db)
        self._attendance = AttendanceRepository(db)
        self._attendance_svc = AttendanceService(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("WFH request not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        wfh_date: date,
        company_id: UUID | None = None,
        end_date: date | None = None,
        portion: str = "full_day",
        reason: str | None = None,
        status: str = "draft",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if portion not in _PORTIONS:
            raise AppException(f"Invalid portion '{portion}'")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            wfh_date=wfh_date,
            end_date=end_date or wfh_date,
            portion=portion,
            reason=reason,
            status=status,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidAttendanceState("Only draft WFH requests can be submitted")
        updated = self._repo.update(ctx, row_id, status="submitted")
        try:
            from modules.hr.service.hr_notify import notify_employee
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, row.employee_id)
            emp_name = (
                f"{emp.first_name} {emp.last_name}".strip()
                if emp is not None
                else "Team member"
            )
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.wfh_submitted",
                template_name="WFH Submitted",
                event_type="hr.wfh_submitted",
                title="WFH request submitted",
                body=f"WFH for {row.wfh_date} is pending manager approval.",
                kind="wfh",
                cc_reporting_manager=False,
                extra={"wfh_request_id": str(row.id), "href": "/wfh"},
            )
            mgr_id = getattr(emp, "reporting_manager_id", None) if emp else None
            if mgr_id:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=mgr_id,
                    template_code="hr.wfh_manager",
                    template_name="Team WFH Request",
                    event_type="hr.wfh_manager",
                    title=f"WFH from {emp_name}",
                    body=(
                        f"{emp_name} requested WFH for {row.wfh_date}. "
                        "Open Team Approvals."
                    ),
                    kind="wfh",
                    cc_reporting_manager=False,
                    extra={
                        "wfh_request_id": str(row.id),
                        "href": "/approvals",
                        "employee_id": str(row.employee_id),
                    },
                )
        except Exception:
            pass
        return updated

    def manager_approve(
        self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None
    ):
        """Manager step — pending HR; attendance applied only on HR approve."""
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState(
                "Only submitted WFH requests can be manager-approved"
            )
        updated = self._repo.update(
            ctx,
            row_id,
            status="manager_approved",
            manager_approver_id=approver_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_wfh_request",
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
                template_code="hr.wfh_manager_approved",
                template_name="WFH Manager Approved",
                event_type="hr.wfh_manager_approved",
                title="WFH approved by manager",
                body=(
                    f"Your WFH for {row.wfh_date} was approved by your manager "
                    "and is pending HR."
                ),
                kind="wfh",
                cc_reporting_manager=False,
                extra={"wfh_request_id": str(row.id), "href": "/wfh"},
            )
            exclude: set[UUID] = set()
            if ctx.user_id:
                exclude.add(ctx.user_id)
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.attendance:update",
                template_code="hr.wfh_pending_hr",
                template_name="WFH Pending HR",
                event_type="hr.wfh_pending_hr",
                title="WFH pending HR approval",
                body=(
                    f"WFH for {row.wfh_date} was manager-approved and needs "
                    "HR final approval."
                ),
                kind="wfh",
                extra={"href": "/hr/ess-inbox", "wfh_request_id": str(row.id)},
                exclude_user_ids=exclude,
            )
        except Exception:
            pass
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID):
        """HR final approval — marks WFH attendance."""
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidAttendanceState(
                "WFH must be submitted or manager-approved for HR approval"
            )
        start = row.wfh_date
        end = row.end_date or row.wfh_date
        cur = start
        while cur <= end:
            self._upsert_wfh_attendance(ctx, row, cur)
            cur += timedelta(days=1)
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_wfh_request",
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
                template_code="hr.wfh_approved",
                template_name="WFH Approved",
                event_type="hr.wfh_approved",
                title="WFH approved",
                body=(
                    f"Your WFH for {row.wfh_date} was approved by HR. "
                    "You may web punch without geofence."
                ),
                kind="wfh",
                extra={"wfh_request_id": str(row.id), "href": "/wfh"},
            )
        except Exception:
            pass
        return updated

    def reject(
        self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None
    ):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidAttendanceState(
                "Only submitted/manager-approved WFH requests can be rejected"
            )
        return self._repo.update(
            ctx,
            row_id,
            status="rejected",
            manager_approver_id=approver_employee_id
            or getattr(row, "manager_approver_id", None),
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )

    def _upsert_wfh_attendance(self, ctx: TenantContext, row, day: date) -> None:
        status = "work_from_home"
        if row.portion in {"first_half", "second_half"}:
            status = "half_day"
        existing = None
        for cand in self._attendance.list_rows(ctx, row.company_id):
            if cand.employee_id == row.employee_id and cand.attendance_date == day:
                existing = cand
                break
        notes = f"wfh:{row.portion}"
        if existing:
            if existing.status == "locked":
                return
            self._attendance.update(
                ctx,
                existing.id,
                attendance_status=status,
                source="web",
                notes=((existing.notes or "") + " | " + notes).strip(" |"),
            )
        else:
            self._attendance_svc.create(
                ctx,
                branch_id=row.branch_id,
                employee_id=row.employee_id,
                company_id=row.company_id,
                attendance_date=day,
                attendance_status=status,
                source="web",
                notes=notes,
            )

    @staticmethod
    def is_approved_wfh_day(rows, employee_id: UUID, day: date) -> bool:
        for row in rows:
            if row.employee_id != employee_id:
                continue
            if row.status != "approved":
                continue
            end = row.end_date or row.wfh_date
            if row.wfh_date <= day <= end:
                return True
        return False
