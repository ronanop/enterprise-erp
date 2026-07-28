"""Employee self-service application logic."""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssAttendanceResponse,
    EssLeaveBalanceResponse,
    EssLeaveRequestCreate,
    EssLeaveRequestResponse,
    EssLeaveTypeResponse,
    EssMeResponse,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPunchResponse,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.engines.attendance_engine import compute_total_hours
from modules.hr.service.leave_service import (
    LeaveBalanceService,
    LeaveRequestService,
    LeaveTypeService,
)
from modules.master_data.domain.entities import EmployeeEntity
from modules.master_data.repository.employee_repository import EmployeeRepository
from modules.payroll.service.payslip_service import PayslipService


def _business_now() -> datetime:
    """Current time in the configured business timezone (aware)."""
    try:
        tz = ZoneInfo(get_settings().app_timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


def _attendance_response(row) -> EssAttendanceResponse:
    return EssAttendanceResponse(
        id=row.id,
        attendance_date=row.attendance_date,
        check_in_at=getattr(row, "check_in_at", None),
        check_out_at=getattr(row, "check_out_at", None),
        total_hours=getattr(row, "total_hours", None),
        attendance_status=row.attendance_status,
        source=row.source,
        status=row.status,
    )


def _leave_request_response(row) -> EssLeaveRequestResponse:
    return EssLeaveRequestResponse(
        id=row.id,
        document_number=row.document_number,
        leave_type_id=row.leave_type_id,
        start_date=row.start_date,
        end_date=row.end_date,
        days_count=row.days_count,
        reason=getattr(row, "reason", None),
        status=row.status,
    )


class EssService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeRepository(db)
        self._leave_types = LeaveTypeService(db)
        self._leave_balances = LeaveBalanceService(db)
        self._leave_requests = LeaveRequestService(db)
        self._attendance = AttendanceService(db)
        self._payslips = PayslipService(db)

    def resolve_employee(self, ctx: TenantContext) -> EmployeeEntity:
        employee = self._employees.get_by_user_id(ctx, ctx.user_id)
        if employee is None:
            raise NotFoundException("No employee profile linked to this user")
        return employee

    def get_me(self, ctx: TenantContext) -> EssMeResponse:
        emp = self.resolve_employee(ctx)
        return EssMeResponse(
            employee_id=emp.id,
            company_id=emp.company_id,
            branch_id=emp.branch_id,
            department_id=emp.department_id,
            employee_code=emp.employee_code,
            first_name=emp.first_name,
            last_name=emp.last_name,
            email=emp.email,
            mobile=emp.mobile,
            designation=emp.designation,
            date_of_joining=emp.date_of_joining,
            status=emp.status,
            display_name=f"{emp.first_name} {emp.last_name}".strip(),
        )

    def list_leave_types(self, ctx: TenantContext) -> list[EssLeaveTypeResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_types.list(ctx, emp.company_id)
        return [
            EssLeaveTypeResponse.model_validate(row)
            for row in rows
            if getattr(row, "status", "active") != "archived"
        ]

    def list_leave_balances(self, ctx: TenantContext) -> list[EssLeaveBalanceResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_balances.list(ctx, emp.company_id)
        return [
            EssLeaveBalanceResponse.model_validate(row)
            for row in rows
            if row.employee_id == emp.id
        ]

    def list_leave_requests(self, ctx: TenantContext) -> list[EssLeaveRequestResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._leave_requests.list(ctx, emp.company_id)
        return [_leave_request_response(row) for row in rows if row.employee_id == emp.id]

    def create_leave_request(
        self, ctx: TenantContext, body: EssLeaveRequestCreate
    ) -> EssLeaveRequestResponse:
        emp = self.resolve_employee(ctx)
        row = self._leave_requests.create(
            ctx,
            branch_id=emp.branch_id,
            employee_id=emp.id,
            company_id=emp.company_id,
            leave_type_id=body.leave_type_id,
            start_date=body.start_date,
            end_date=body.end_date,
            days_count=body.days_count,
            reason=body.reason,
        )
        submitted = self._leave_requests.submit(ctx, row.id)
        return _leave_request_response(submitted)

    def list_attendance(
        self,
        ctx: TenantContext,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[EssAttendanceResponse]:
        emp = self.resolve_employee(ctx)
        rows = self._attendance.list(ctx, emp.company_id)
        result: list[EssAttendanceResponse] = []
        for row in rows:
            if row.employee_id != emp.id:
                continue
            if from_date and row.attendance_date < from_date:
                continue
            if to_date and row.attendance_date > to_date:
                continue
            result.append(_attendance_response(row))
        result.sort(key=lambda r: r.attendance_date, reverse=True)
        return result

    def punch(self, ctx: TenantContext) -> EssPunchResponse:
        emp = self.resolve_employee(ctx)
        # Business-local "today" so IST midnight matches the work day employees expect.
        local_now = _business_now()
        today = local_now.date()
        # Persist timestamps in UTC (timestamptz).
        now_utc = local_now.astimezone(timezone.utc)

        rows = [
            row
            for row in self._attendance.list(ctx, emp.company_id)
            if row.employee_id == emp.id and row.attendance_date == today
        ]
        if not rows:
            created = self._attendance.create(
                ctx,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                company_id=emp.company_id,
                attendance_date=today,
                check_in_at=now_utc,
                total_hours=None,
                attendance_status="present",
                source="mobile",
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(created)
            )

        current = rows[0]
        if getattr(current, "status", None) == "locked":
            raise ConflictException("Today's attendance is locked")
        if getattr(current, "check_out_at", None) is not None:
            raise ConflictException("Already checked out for today")

        check_in = getattr(current, "check_in_at", None)
        if check_in is None:
            updated_in = self._attendance.update(
                ctx,
                current.id,
                check_in_at=now_utc,
                total_hours=None,
                attendance_status="present",
            )
            return EssPunchResponse(
                action="check_in", attendance=_attendance_response(updated_in)
            )

        # Freeze total hours at checkout (check-in → now).
        total_hours = compute_total_hours(check_in, now_utc)
        updated = self._attendance.update(
            ctx,
            current.id,
            check_out_at=now_utc,
            total_hours=total_hours,
            attendance_status=current.attendance_status or "present",
        )
        return EssPunchResponse(
            action="check_out", attendance=_attendance_response(updated)
        )

    def list_payslips(self, ctx: TenantContext) -> list[EssPayslipSummary]:
        emp = self.resolve_employee(ctx)
        rows = self._payslips.list(ctx, emp.company_id)
        return [
            EssPayslipSummary(
                id=row.id,
                document_number=row.document_number,
                employee_code=row.employee_code,
                employee_name=row.employee_name,
                payroll_period_id=row.payroll_period_id,
                gross_salary=row.gross_salary,
                total_deductions=row.total_deductions,
                net_salary=row.net_salary,
                issued_at=row.issued_at,
                delivery_status=row.delivery_status,
                payment_status=row.payment_status,
                status=row.status,
            )
            for row in rows
            if row.employee_id == emp.id
        ]

    def get_payslip(self, ctx: TenantContext, payslip_id: UUID) -> EssPayslipDetail:
        emp = self.resolve_employee(ctx)
        row = self._payslips.get(ctx, payslip_id)
        if row.employee_id != emp.id:
            raise ForbiddenException("Payslip does not belong to this employee")
        return EssPayslipDetail(
            id=row.id,
            document_number=row.document_number,
            employee_code=row.employee_code,
            employee_name=row.employee_name,
            payroll_period_id=row.payroll_period_id,
            gross_salary=row.gross_salary,
            total_deductions=row.total_deductions,
            net_salary=row.net_salary,
            issued_at=row.issued_at,
            delivery_status=row.delivery_status,
            payment_status=row.payment_status,
            status=row.status,
            payslip_json=row.payslip_json,
            company_id=row.company_id,
            branch_id=row.branch_id,
        )
