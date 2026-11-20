"""Attendance service."""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import AttendanceRecordStatus
from modules.hr.repository.attendance_repository import AttendanceRepository
from modules.hr.schemas import AttendanceResponse
from modules.hr.service.attendance_policy_apply import AttendancePolicyApplyService
from modules.hr.service.engines import AttendanceEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.hierarchy import OrgDepartment


class AttendanceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AttendanceRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = AttendanceEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)
        self._policy = AttendancePolicyApplyService(db)

    def serialize_rows(self, rows: list) -> list[AttendanceResponse]:
        """Attach employee code/name/department for attendance list UI."""
        if not rows:
            return []
        emp_ids = {getattr(r, "employee_id", None) for r in rows}
        emp_ids.discard(None)
        employees = {
            e.id: e
            for e in self._db.scalars(
                select(MasterEmployee).where(MasterEmployee.id.in_(list(emp_ids)))
            ).all()
        }
        dept_ids = {e.department_id for e in employees.values() if e.department_id}
        departments = {
            d.id: d
            for d in self._db.scalars(
                select(OrgDepartment).where(OrgDepartment.id.in_(list(dept_ids)))
            ).all()
        } if dept_ids else {}

        out: list[AttendanceResponse] = []
        for row in rows:
            emp = employees.get(getattr(row, "employee_id", None))
            dept = departments.get(emp.department_id) if emp and emp.department_id else None
            name = ""
            code = None
            dept_id = None
            dept_name = None
            if emp is not None:
                code = emp.employee_code
                # Prefer live name; strip soft-delete suffix noise if present.
                raw_code = str(emp.employee_code or "")
                base_code = raw_code.split("-DEL-", 1)[0]
                first = (emp.first_name or "").strip()
                last = (emp.last_name or "").strip()
                name = f"{first} {last}".strip() or base_code
                if emp.is_deleted and "-DEL-" in raw_code:
                    # Still expose base code for UI until remap catches up.
                    code = base_code
                dept_id = emp.department_id
                if dept is not None and not dept.is_deleted:
                    dept_name = dept.department_name
            base = AttendanceResponse.model_validate(row)
            out.append(
                base.model_copy(
                    update={
                        "employee_code": code,
                        "employee_name": name or None,
                        "department_id": dept_id,
                        "department_name": dept_name,
                    }
                )
            )
        return out

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        employee_id: UUID | None = None,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
    ):
        # Employee-scoped reads ignore company stamp mismatches (biometric ingest).
        if employee_id is not None:
            return self._repo.list_for_employee(
                ctx,
                employee_id=employee_id,
                date_from=date_from,
                date_to=date_to,
            )
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(
            ctx,
            cid,
            employee_id=employee_id,
            date_from=date_from,
            date_to=date_to,
        )

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Attendance not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        # Never allow company_id=None on insert (module-wide admins often have no session company).
        # Prefer: explicit → employee master → branch → write-scope fallback.
        fields.pop("company_id", None)
        emp = self._master.get_employee(ctx, employee_id)
        emp_company = getattr(emp, "company_id", None)
        emp_branch = getattr(emp, "branch_id", None)
        if emp_branch is not None:
            try:
                self._scope.validate_branch_access(ctx, emp_branch)
                branch_id = emp_branch
            except Exception:
                pass
        else:
            self._scope.validate_branch_access(ctx, branch_id)

        cid = company_id or emp_company
        cid = self._scope.resolve_write_company_id(ctx, cid, branch_id=branch_id)
        if cid is None:
            from core.exceptions import ValidationException

            raise ValidationException(
                "Company is required. Select a company (or a branch that belongs to one) and try again."
            )
        record_status = fields.pop("status", AttendanceRecordStatus.RECORDED.value)
        fields = self._policy.apply_to_fields(ctx, cid, employee_id, fields)
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            status=record_status,
            **fields,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        if row.status == AttendanceRecordStatus.LOCKED.value:
            from modules.hr.domain.exceptions import InvalidAttendanceState

            raise InvalidAttendanceState("Locked attendance cannot be adjusted")
        merged = {
            "check_in_at": fields.get("check_in_at", row.check_in_at),
            "check_out_at": fields.get("check_out_at", row.check_out_at),
            "total_hours": fields.get("total_hours", row.total_hours),
            "attendance_status": fields.get("attendance_status", row.attendance_status),
            "shift_id": fields.get("shift_id", row.shift_id),
            "early_leave_minutes": fields.get("early_leave_minutes", row.early_leave_minutes),
        }
        applied = self._policy.apply_to_fields(ctx, row.company_id, row.employee_id, merged)
        for key in ("attendance_status", "late_minutes", "total_hours", "check_in_at", "check_out_at"):
            if key in applied and applied[key] is not None:
                fields[key] = applied[key]
        self._engine.adjust(row)
        return self._repo.update(ctx, row_id, status=AttendanceRecordStatus.ADJUSTED.value, **fields)

    def lock(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.lock(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_attendance",
            entity_id=row_id,
            operation="lock",
            performed_by=ctx.user_id,
        )
        return updated
