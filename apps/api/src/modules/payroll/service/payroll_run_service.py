"""Payroll run application service."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.adapters.hr_port import PayrollHrAdapter
from modules.payroll.domain.enums import EmployeeSalaryStatus, PayEntityType, RunLineStatus
from modules.payroll.models import PayPayrollRun
from modules.payroll.repository.base import utcnow
from modules.payroll.repository.employee_salary_repository import EmployeeSalaryRepository
from modules.payroll.repository.payroll_period_repository import PayrollPeriodRepository
from modules.payroll.repository.payroll_run_line_repository import PayrollRunLineRepository
from modules.payroll.repository.payroll_run_repository import PayrollRunRepository
from modules.payroll.repository.bonus_repository import BonusRepository
from modules.payroll.repository.payroll_adjustment_repository import PayrollAdjustmentRepository
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import PayrollRunEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator

_STANDARD_DAYS = Decimal("30")


class PayrollRunService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PayrollRunRepository(db)
        self._line_repo = PayrollRunLineRepository(db)
        self._salary_repo = EmployeeSalaryRepository(db)
        self._period_repo = PayrollPeriodRepository(db)
        self._bonus_repo = BonusRepository(db)
        self._adj_repo = PayrollAdjustmentRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PayrollRunEngine()
        self._hr = PayrollHrAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollRun:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payroll run not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PayEntityType.PAYROLL_RUN, cid, PayPayrollRun, "document_number")
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_run",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def calculate(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)

        employment_facts = self._hr.employment_facts(ctx, row.company_id)
        attendance_facts = self._hr.attendance_facts(ctx, row.company_id)
        leave_facts = self._hr.leave_facts(ctx, row.company_id)

        period = self._period_repo.get(ctx, row.payroll_period_id)
        period_start = period.start_date if period else None
        period_end = period.end_date if period else None

        employment_by_employee = {
            fact["employee_id"]: fact for fact in employment_facts
        }

        bonus_by_employee, earn_adj_by_employee, ded_adj_by_employee, adj_labels_by_employee = (
            self._period_add_ons(ctx, row.company_id, row.payroll_period_id)
        )

        salaries = [
            s
            for s in self._salary_repo.list_rows(ctx, row.company_id)
            if s.status == EmployeeSalaryStatus.ACTIVE.value
        ]
        target_id = getattr(row, "target_employee_id", None)
        if target_id is not None:
            salaries = [s for s in salaries if s.employee_id == target_id]
            # FNF may still need a line when salary was already ended — fall back to employment CTC
            if not salaries and employment_by_employee.get(target_id):
                emp_fact = employment_by_employee[target_id]
                gross_input = emp_fact.get("ctc_amount")
                if gross_input:
                    paid_days, lop_days, leave_days, has_attendance, overtime_minutes = self._resolve_days(
                        target_id,
                        attendance_facts,
                        leave_facts,
                        period_start=period_start,
                        period_end=period_end,
                    )
                    amounts = self._engine.compute_salary_breakdown(
                        gross_input,
                        paid_days=paid_days,
                        prorate=has_attendance,
                        overtime_minutes=overtime_minutes,
                        bonus_amount=bonus_by_employee.get(target_id, Decimal("0")),
                        earning_adjustments=earn_adj_by_employee.get(target_id, Decimal("0")),
                        deduction_adjustments=ded_adj_by_employee.get(target_id, Decimal("0")),
                        adjustment_labels=adj_labels_by_employee.get(target_id),
                    )
                    self._line_repo.create(
                        ctx,
                        company_id=row.company_id,
                        branch_id=row.branch_id,
                        payroll_run_id=row.id,
                        employee_id=target_id,
                        employee_salary_id=None,
                        department_id=emp_fact.get("department_id"),
                        employment_id=emp_fact.get("employment_id"),
                        paid_days=paid_days,
                        lop_days=lop_days,
                        leave_days=leave_days,
                        gross_earnings=amounts["gross_earnings"],
                        total_deductions=amounts["total_deductions"],
                        net_pay=amounts["net_pay"],
                        employer_contribution=amounts["employer_contribution"],
                        component_breakdown_json=amounts["component_breakdown_json"],
                        status=RunLineStatus.CALCULATED.value,
                    )
                    self._engine.calculate(row)
                    return self._repo.update(
                        ctx,
                        row_id,
                        status=row.status,
                        employee_count=1,
                        total_gross=amounts["gross_earnings"],
                        total_deduction=amounts["total_deductions"],
                        total_net=amounts["net_pay"],
                        total_employer_cost=amounts["employer_contribution"],
                    )

        existing_lines = [
            line
            for line in self._line_repo.list_rows(ctx, row.company_id)
            if line.payroll_run_id == row.id
        ]
        for line in existing_lines:
            self._line_repo.update(
                ctx,
                line.id,
                is_deleted=True,
                deleted_at=utcnow(),
                deleted_by=ctx.user_id,
            )

        total_gross = Decimal("0.0000")
        total_deduction = Decimal("0.0000")
        total_net = Decimal("0.0000")
        total_employer_cost = Decimal("0.0000")
        employee_count = 0

        for salary in salaries:
            emp_fact = employment_by_employee.get(salary.employee_id)
            paid_days, lop_days, leave_days, has_attendance, overtime_minutes = self._resolve_days(
                salary.employee_id,
                attendance_facts,
                leave_facts,
                period_start=period_start,
                period_end=period_end,
            )

            gross_input = salary.gross_amount or salary.ctc_amount
            if not gross_input and emp_fact and emp_fact.get("ctc_amount") is not None:
                gross_input = emp_fact["ctc_amount"]
            if not gross_input:
                continue

            amounts = self._engine.compute_salary_breakdown(
                gross_input,
                paid_days=paid_days,
                prorate=has_attendance,
                overtime_minutes=overtime_minutes,
                bonus_amount=bonus_by_employee.get(salary.employee_id, Decimal("0")),
                earning_adjustments=earn_adj_by_employee.get(salary.employee_id, Decimal("0")),
                deduction_adjustments=ded_adj_by_employee.get(salary.employee_id, Decimal("0")),
                adjustment_labels=adj_labels_by_employee.get(salary.employee_id),
            )

            employment_id = salary.employment_id
            if emp_fact and emp_fact.get("employment_id"):
                employment_id = emp_fact["employment_id"]

            self._line_repo.create(
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                payroll_run_id=row.id,
                employee_id=salary.employee_id,
                employee_salary_id=salary.id,
                department_id=salary.department_id,
                employment_id=employment_id,
                paid_days=paid_days,
                lop_days=lop_days,
                leave_days=leave_days,
                gross_earnings=amounts["gross_earnings"],
                total_deductions=amounts["total_deductions"],
                net_pay=amounts["net_pay"],
                employer_contribution=amounts["employer_contribution"],
                component_breakdown_json=amounts["component_breakdown_json"],
                status=RunLineStatus.CALCULATED.value,
            )

            employee_count += 1
            total_gross += amounts["gross_earnings"]
            total_deduction += amounts["total_deductions"]
            total_net += amounts["net_pay"]
            total_employer_cost += amounts["employer_contribution"]

        self._engine.calculate(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            employee_count=employee_count,
            total_gross=total_gross,
            total_deduction=total_deduction,
            total_net=total_net,
            total_employer_cost=total_employer_cost,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pay_payroll_run",
            entity_id=row.id,
            operation="calculate",
            performed_by=ctx.user_id,
        )
        return updated

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        try:
            from modules.hr.service.hr_notify import notify_employee
            from modules.payroll.repository.payroll_run_line_repository import (
                PayrollRunLineRepository,
            )

            lines = [
                line
                for line in PayrollRunLineRepository(self._db).list_rows(ctx, updated.company_id)
                if line.payroll_run_id == updated.id and not getattr(line, "is_deleted", False)
            ]
            for line in lines:
                notify_employee(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    employee_id=line.employee_id,
                    template_code="hr.payroll_approved",
                    template_name="Payroll Approved",
                    event_type="hr.payroll_approved",
                    title="Payroll run approved",
                    body=f"Payroll {updated.document_number} was approved. Net: {line.net_pay}",
                    kind="payroll",
                    extra={"payroll_run_id": str(updated.id)},
                )
        except Exception:
            pass
        return updated

    @staticmethod
    def _resolve_days(
        employee_id: UUID,
        attendance_facts: list[dict],
        leave_facts: list[dict],
        *,
        period_start=None,
        period_end=None,
    ) -> tuple[Decimal, Decimal, Decimal, bool, int]:
        emp_attendance = [
            a
            for a in attendance_facts
            if a.get("employee_id") == employee_id
            and (
                period_start is None
                or period_end is None
                or a.get("attendance_date") is None
                or (period_start <= a["attendance_date"] <= period_end)
            )
        ]
        emp_leave = [
            leave
            for leave in leave_facts
            if leave.get("employee_id") == employee_id
            and (
                period_start is None
                or period_end is None
                or leave.get("end_date") is None
                or leave.get("start_date") is None
                or not (leave["end_date"] < period_start or leave["start_date"] > period_end)
            )
        ]

        leave_days = sum(
            (Decimal(str(leave.get("days_count") or 0)) for leave in emp_leave),
            Decimal("0"),
        )

        overtime_minutes = sum(int(a.get("overtime_minutes") or 0) for a in emp_attendance)

        if not emp_attendance:
            return _STANDARD_DAYS, Decimal("0"), leave_days, False, overtime_minutes

        lop_days = Decimal("0")
        for record in emp_attendance:
            status = record.get("attendance_status")
            if status == "absent":
                lop_days += Decimal("1")
            elif status == "half_day":
                lop_days += Decimal("0.5")

        paid_days = _STANDARD_DAYS - lop_days
        if paid_days < 0:
            paid_days = Decimal("0")

        return paid_days, lop_days, leave_days, True, overtime_minutes

    def _period_add_ons(
        self,
        ctx: TenantContext,
        company_id: UUID,
        payroll_period_id: UUID,
    ) -> tuple[
        dict[UUID, Decimal],
        dict[UUID, Decimal],
        dict[UUID, Decimal],
        dict[UUID, dict[str, float]],
    ]:
        """Approved bonuses + applied adjustments for this payroll period."""
        bonus_by: dict[UUID, Decimal] = {}
        for b in self._bonus_repo.list_rows(ctx, company_id):
            if b.status not in {"approved", "paid"}:
                continue
            if b.payroll_period_id != payroll_period_id:
                continue
            bonus_by[b.employee_id] = bonus_by.get(b.employee_id, Decimal("0")) + Decimal(
                str(b.amount or 0)
            )

        earn_by: dict[UUID, Decimal] = {}
        ded_by: dict[UUID, Decimal] = {}
        labels: dict[UUID, dict[str, float]] = {}
        for adj in self._adj_repo.list_rows(ctx, company_id):
            if adj.status != "applied":
                continue
            if adj.payroll_period_id != payroll_period_id:
                continue
            amount = Decimal(str(adj.amount or 0))
            eid = adj.employee_id
            reason = str(adj.reason or "").lower()
            bucket = labels.setdefault(eid, {"arrears": 0.0, "incentives": 0.0})
            if adj.adjustment_type == "deduction":
                ded_by[eid] = ded_by.get(eid, Decimal("0")) + amount
            else:
                earn_by[eid] = earn_by.get(eid, Decimal("0")) + amount
                if "arrear" in reason:
                    bucket["arrears"] += float(amount)
                elif "incentive" in reason:
                    bucket["incentives"] += float(amount)
        return bonus_by, earn_by, ded_by, labels
