"""Employment application service with lifecycle history."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import EmploymentStatus, HrEntityType
from modules.hr.domain.exceptions import InvalidEmploymentState
from modules.hr.models import HrEmployment
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.lifecycle_event_repository import LifecycleEventRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import EmploymentEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class EmploymentService:
    def __init__(self, db: Session) -> None:
        self._repo = EmploymentRepository(db)
        self._lifecycle = LifecycleEventRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = EmploymentEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)
        self._db = db

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrEmployment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Employment not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        status = fields.get("status", EmploymentStatus.DRAFT.value)
        if status in EmploymentEngine.ACTIVE_SET:
            self._ensure_single_active(ctx, cid, employee_id)
        doc = self._numbers.generate(HrEntityType.EMPLOYMENT, cid, HrEmployment, "document_number")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            **fields,
        )
        if row.status in EmploymentEngine.ACTIVE_SET:
            self._sync_master_status(ctx, employee_id, "active")
        self._record_lifecycle(
            ctx,
            row,
            from_status=None,
            to_status=row.status,
            event_type="created",
            notes="Employment record created",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_employment",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Employment not found")
        return row

    def start_onboarding(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_start_onboarding(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            lifecycle_source=row.lifecycle_source,
        )
        self._sync_master_status(ctx, row.employee_id, "onboarding")
        self._record_lifecycle(ctx, row, prev, row.status, "onboarding_started")
        return updated

    def start_probation(self, ctx: TenantContext, row_id: UUID, *, probation_days: int = 90):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_start_probation(row, probation_days=probation_days)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            probation_start_date=row.probation_start_date,
            probation_end_date=row.probation_end_date,
            lifecycle_source=row.lifecycle_source,
        )
        self._sync_master_status(ctx, row.employee_id, "probation")
        self._record_lifecycle(
            ctx,
            row,
            prev,
            row.status,
            "probation_started",
            notes=f"Probation days={probation_days}",
            meta={"probation_end_date": str(row.probation_end_date)},
        )
        return updated

    def activate(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        employee_code: str | None = None,
        shift_id: UUID | None = None,
        start_probation: bool = True,
        probation_days: int = 90,
        mark_payroll_eligible: bool = True,
    ):
        """Activate hire: optional permanent Emp ID, shift assign, payroll eligible, Active (+ probation)."""
        row = self.get(ctx, row_id)
        prev = row.status

        emp = self._master.get_employee(ctx, row.employee_id)
        current_code = getattr(emp, "employee_code", "") or ""
        needs_code = current_code.startswith("ONB-") or not current_code
        if needs_code:
            if not employee_code or not str(employee_code).strip():
                raise InvalidEmploymentState(
                    "Manual Employee ID is required at activation "
                    "(temporary ONB-* codes cannot remain after activation)"
                )
            code = str(employee_code).strip().upper()
            from modules.master_data.service.employee_service import EmployeeService

            EmployeeService(self._db).update_employee(
                ctx, row.employee_id, employee_code=code
            )

        self._ensure_single_active(ctx, row.company_id, row.employee_id, exclude_id=row_id)
        self._engine.apply_activate(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            payroll_eligible=True if mark_payroll_eligible else row.payroll_eligible,
        )
        self._sync_master_status(ctx, row.employee_id, "active")
        self._record_lifecycle(
            ctx,
            row,
            prev,
            row.status,
            "activated",
            notes="Activated with payroll eligibility"
            + (f"; emp_id={employee_code}" if employee_code else ""),
            meta={
                "payroll_eligible": bool(mark_payroll_eligible),
                "employee_code": employee_code,
                "shift_id": str(shift_id) if shift_id else None,
            },
        )

        if shift_id is not None:
            try:
                from datetime import date as date_cls

                from modules.hr.domain.enums import ShiftAssignmentStatus
                from modules.hr.service.shift_service import ShiftAssignmentService

                assignment = ShiftAssignmentService(self._db).create(
                    ctx,
                    branch_id=row.branch_id,
                    employee_id=row.employee_id,
                    shift_id=shift_id,
                    company_id=row.company_id,
                    effective_from=row.date_of_joining or date_cls.today(),
                    status=ShiftAssignmentStatus.DRAFT.value,
                )
                try:
                    ShiftAssignmentService(self._db).submit(ctx, assignment.id)
                    ShiftAssignmentService(self._db).approve(ctx, assignment.id)
                except Exception:
                    pass
            except Exception:
                pass

        if start_probation and updated and updated.status == EmploymentStatus.ACTIVE.value:
            updated = self.start_probation(ctx, row_id, probation_days=probation_days)

        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.employee_activated",
                template_name="Employee Activated",
                event_type="hr.employee_activated",
                title="Welcome — your employment is active",
                body="Your employee profile has been activated. You are payroll-eligible.",
                kind="employment",
            )
        except Exception:
            pass
        return updated

    def confirm(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_confirm(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            confirmation_date=row.confirmation_date,
        )
        self._sync_master_status(ctx, row.employee_id, "active")
        self._record_lifecycle(
            ctx,
            row,
            prev,
            row.status,
            "confirmed",
            meta={"confirmation_date": str(row.confirmation_date)},
        )
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.confirmation",
                template_name="Employment Confirmation",
                event_type="hr.confirmation",
                title="Employment confirmed",
                body="Your probation has been confirmed. Welcome as a confirmed employee.",
                kind="confirmation",
            )
        except Exception:
            pass
        return updated

    def extend_probation(self, ctx: TenantContext, row_id: UUID, *, extra_days: int):
        if extra_days <= 0:
            raise InvalidEmploymentState("extra_days must be positive")
        row = self.get(ctx, row_id)
        prev_end = row.probation_end_date
        self._engine.apply_extend_probation(row, extra_days=extra_days)
        updated = self._repo.update(ctx, row_id, probation_end_date=row.probation_end_date)
        self._record_lifecycle(
            ctx,
            row,
            row.status,
            row.status,
            "probation_extended",
            notes=f"Extended by {extra_days} days",
            meta={"from": str(prev_end), "to": str(row.probation_end_date)},
        )
        return updated

    def start_notice(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_notice(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._sync_master_status(ctx, row.employee_id, "notice_period")
        self._record_lifecycle(ctx, row, prev, row.status, "notice_started")
        return updated

    def mark_separated(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_separate(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._sync_master_status(ctx, row.employee_id, "resigned")
        self._record_lifecycle(ctx, row, prev, row.status, "separated")
        return updated

    def mark_ex_employee(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_ex_employee(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._sync_master_status(ctx, row.employee_id, "ex_employee")
        self._record_lifecycle(ctx, row, prev, row.status, "ex_employee")
        return updated

    def end(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        prev = row.status
        self._engine.apply_end(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._record_lifecycle(ctx, row, prev, row.status, "ended")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_employment",
            entity_id=row_id,
            operation="end",
            performed_by=ctx.user_id,
        )
        return updated

    def list_lifecycle(self, ctx: TenantContext, employee_id: UUID):
        self._master.get_employee(ctx, employee_id)
        return self._lifecycle.list_for_employee(ctx, employee_id)

    def _record_lifecycle(
        self,
        ctx: TenantContext,
        row: HrEmployment,
        from_status: str | None,
        to_status: str,
        event_type: str,
        notes: str | None = None,
        meta: dict | None = None,
    ) -> None:
        self._lifecycle.create(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            employee_id=row.employee_id,
            employment_id=row.id,
            from_status=from_status,
            to_status=to_status,
            event_type=event_type,
            notes=notes,
            meta_json=meta,
        )

    def _sync_master_status(self, ctx: TenantContext, employee_id: UUID, status: str) -> None:
        try:
            self._master.update_employee_status(ctx, employee_id, status)
        except AttributeError:
            # Adapter may not expose update yet — best-effort via ORM if present
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, employee_id)
            if emp is not None:
                emp.status = status

    def _ensure_single_active(
        self,
        ctx: TenantContext,
        company_id: UUID,
        employee_id: UUID,
        exclude_id: UUID | None = None,
    ) -> None:
        for existing in self._repo.list_rows(ctx, company_id):
            if existing.employee_id != employee_id:
                continue
            if exclude_id and existing.id == exclude_id:
                continue
            if existing.status in EmploymentEngine.ACTIVE_SET:
                raise ConflictException("Employee already has an active employment record")
