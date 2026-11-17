"""On Duty + OT/Overday allotment services."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.exceptions import InvalidAttendanceState
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.on_duty_ot_repository import OnDutyRequestRepository, OtAllotmentRepository
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.hr_scope_validator import HrScopeValidator

_PORTIONS = {"first_half", "second_half", "full_day"}
_OT_TYPES = {"overtime", "overday"}


class OnDutyRequestService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OnDutyRequestRepository(db)
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
            raise NotFoundException("On Duty request not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        duty_date: date,
        company_id: UUID | None = None,
        end_date: date | None = None,
        portion: str = "full_day",
        duty_location: str | None = None,
        purpose: str | None = None,
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
            duty_date=duty_date,
            end_date=end_date or duty_date,
            portion=portion,
            duty_location=duty_location,
            purpose=purpose,
            reason=reason,
            status=status,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidAttendanceState("Only draft On Duty requests can be submitted")
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
                template_code="hr.on_duty_submitted",
                template_name="On Duty Submitted",
                event_type="hr.on_duty_submitted",
                title="On Duty request submitted",
                body=(
                    f"On Duty for {row.duty_date} ({row.portion}) is "
                    "pending manager approval."
                ),
                kind="on_duty",
                cc_reporting_manager=False,
                extra={"on_duty_request_id": str(row.id), "href": "/on-duty"},
            )
            mgr_id = getattr(emp, "reporting_manager_id", None) if emp else None
            if mgr_id:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=mgr_id,
                    template_code="hr.on_duty_manager",
                    template_name="Team On Duty Request",
                    event_type="hr.on_duty_manager",
                    title=f"On Duty from {emp_name}",
                    body=(
                        f"{emp_name} requested On Duty for {row.duty_date}. "
                        "Open Team Approvals."
                    ),
                    kind="on_duty",
                    cc_reporting_manager=False,
                    extra={
                        "on_duty_request_id": str(row.id),
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
                "Only submitted On Duty requests can be manager-approved"
            )
        updated = self._repo.update(
            ctx,
            row_id,
            status="manager_approved",
            manager_approver_id=approver_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_on_duty_request",
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
                template_code="hr.on_duty_manager_approved",
                template_name="On Duty Manager Approved",
                event_type="hr.on_duty_manager_approved",
                title="On Duty approved by manager",
                body=(
                    f"Your On Duty for {row.duty_date} was approved by your "
                    "manager and is pending HR."
                ),
                kind="on_duty",
                cc_reporting_manager=False,
                extra={"on_duty_request_id": str(row.id), "href": "/on-duty"},
            )
            exclude: set[UUID] = set()
            if ctx.user_id:
                exclude.add(ctx.user_id)
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="hr.attendance:update",
                template_code="hr.on_duty_pending_hr",
                template_name="On Duty Pending HR",
                event_type="hr.on_duty_pending_hr",
                title="On Duty / On Tour pending HR approval",
                body=(
                    f"On Duty for {row.duty_date} was manager-approved and "
                    "needs HR final approval."
                ),
                kind="on_duty",
                extra={
                    "href": "/hr/ess-inbox",
                    "on_duty_request_id": str(row.id),
                },
                exclude_user_ids=exclude,
            )
        except Exception:
            pass
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID):
        """HR final approval — marks on-duty attendance."""
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidAttendanceState(
                "On Duty must be submitted or manager-approved for HR approval"
            )

        start = row.duty_date
        end = row.end_date or row.duty_date
        cur = start
        while cur <= end:
            self._upsert_on_duty_attendance(ctx, row, cur)
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
            entity_name="hr_on_duty_request",
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
                template_code="hr.on_duty_approved",
                template_name="On Duty Approved",
                event_type="hr.on_duty_approved",
                title="On Duty approved",
                body=f"Your On Duty for {row.duty_date} was approved by HR.",
                kind="on_duty",
                extra={"on_duty_request_id": str(row.id), "href": "/on-duty"},
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
                "Only submitted/manager-approved On Duty requests can be rejected"
            )
        patch: dict = {
            "status": "rejected",
            "approved_by": ctx.user_id,
            "decided_at": datetime.now(timezone.utc),
        }
        if approver_employee_id is not None:
            patch["manager_approver_id"] = approver_employee_id
        return self._repo.update(ctx, row_id, **patch)

    def _upsert_on_duty_attendance(self, ctx: TenantContext, row, day: date) -> None:
        status = "on_duty"
        if row.portion in {"first_half", "second_half"}:
            status = "half_day"
        existing = None
        for cand in self._attendance.list_rows(ctx, row.company_id):
            if cand.employee_id == row.employee_id and cand.attendance_date == day:
                existing = cand
                break
        notes = f"on_duty:{row.portion}"
        if row.duty_location:
            notes += f"|{row.duty_location}"
        if existing:
            if existing.status == "locked":
                return
            self._attendance.update(
                ctx,
                existing.id,
                attendance_status=status,
                notes=((existing.notes or "") + " | " + notes).strip(" |"),
            )
        else:
            self._attendance_svc.create(
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                employee_id=row.employee_id,
                attendance_date=day,
                attendance_status=status,
                source="manual",
                status="recorded",
                notes=notes,
            )


class OtAllotmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OtAllotmentRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("OT allotment not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        allotment_date: date,
        hours: Decimal | float,
        allotment_type: str = "overtime",
        company_id: UUID | None = None,
        reason: str | None = None,
        status: str = "draft",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if allotment_type not in _OT_TYPES:
            raise AppException(f"Invalid allotment_type '{allotment_type}'")
        hrs = Decimal(str(hours))
        if hrs <= 0:
            raise AppException("hours must be positive")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            allotment_date=allotment_date,
            allotment_type=allotment_type,
            hours=hrs,
            reason=reason,
            status=status,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidAttendanceState("Only draft allotments can be submitted")
        return self._repo.update(ctx, row_id, status="submitted")

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState("Only submitted allotments can be approved")
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_ot_allotment",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidAttendanceState("Only submitted allotments can be rejected")
        return self._repo.update(
            ctx,
            row_id,
            status="rejected",
            approved_by=ctx.user_id,
            decided_at=datetime.now(timezone.utc),
        )
