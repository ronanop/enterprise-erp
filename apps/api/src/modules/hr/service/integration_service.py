"""HR integration facade — Master Data sync + Payroll-ready read exports."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.leave_request_repository import LeaveRequestRepository
from modules.hr.repository.leave_type_repository import LeaveTypeRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator


class HRIntegrationService:
    """Expose employment / attendance / leave facts for future Payroll. No payroll writes."""

    def __init__(self, db: Session) -> None:
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._employment = EmploymentRepository(db)
        self._attendance = AttendanceRepository(db)
        self._leave = LeaveRequestRepository(db)
        self._leave_types = LeaveTypeRepository(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def payroll_employment_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._employment.list_rows(ctx, cid)
        return [
            {
                "employment_id": r.id,
                "employee_id": r.employee_id,
                "employment_type": r.employment_type,
                "status": r.status,
                "date_of_joining": r.date_of_joining,
                "ctc_amount": r.ctc_amount,
                "currency_code": r.currency_code,
            }
            for r in rows
            if r.status in {"active", "probation", "confirmed", "notice_period", "separated"}
        ]

    def payroll_attendance_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [
            {
                "attendance_id": r.id,
                "employee_id": r.employee_id,
                "attendance_date": r.attendance_date,
                "attendance_status": r.attendance_status,
                "total_hours": r.total_hours,
                "status": r.status,
                "shift_id": getattr(r, "shift_id", None),
                "overtime_minutes": int(getattr(r, "overtime_minutes", None) or 0),
            }
            for r in self._attendance.list_rows(ctx, cid)
        ]

    def payroll_leave_facts(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        types = {t.id: t for t in self._leave_types.list_rows(ctx, cid)}
        facts = []
        for r in self._leave.list_rows(ctx, cid):
            if r.status != "approved":
                continue
            lt = types.get(r.leave_type_id)
            facts.append(
                {
                    "leave_request_id": r.id,
                    "employee_id": r.employee_id,
                    "leave_type_id": r.leave_type_id,
                    "leave_type_code": lt.leave_type_code if lt else None,
                    "leave_type_name": lt.leave_type_name if lt else None,
                    "is_paid": bool(lt.is_paid) if lt else True,
                    "start_date": r.start_date,
                    "end_date": r.end_date,
                    "days_count": r.days_count,
                    "status": r.status,
                }
            )
        return facts
