"""Payslip application service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.models.employee_profile import HrEmployeeProfile
from modules.master_data.models.employee import MasterEmployee
from modules.payroll.domain.enums import PayEntityType, PayrollRunStatus
from modules.payroll.domain.bank_export_builder import build_bank_export_csv
from modules.payroll.domain.payslip_document_builder import build_payslip_document, format_payslip_text
from modules.payroll.models import PayPayslip
from modules.payroll.repository.payroll_period_repository import PayrollPeriodRepository
from modules.payroll.repository.payroll_run_line_repository import PayrollRunLineRepository
from modules.payroll.repository.payroll_run_repository import PayrollRunRepository
from modules.payroll.repository.payslip_repository import PayslipRepository
from modules.payroll.schemas import PayslipResponse
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import PayslipEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayslipService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PayslipRepository(db)
        self._run_repo = PayrollRunRepository(db)
        self._line_repo = PayrollRunLineRepository(db)
        self._period_repo = PayrollPeriodRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PayslipEngine()
        self._audit = AuditService(db)

    def _enrich(self, row: PayPayslip) -> PayslipResponse:
        payload = PayslipResponse.model_validate(row)
        meta = row.payslip_json if isinstance(row.payslip_json, dict) else {}
        if meta.get("employee_name"):
            payload.employee_name = str(meta["employee_name"])
        if meta.get("employee_code"):
            payload.employee_code = str(meta["employee_code"])
        emp_block = meta.get("employee") if isinstance(meta.get("employee"), dict) else {}
        if emp_block.get("name"):
            payload.employee_name = str(emp_block["name"])
        if emp_block.get("code"):
            payload.employee_code = str(emp_block["code"])
        if not payload.employee_name or not payload.employee_code:
            emp = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == row.employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if emp is not None:
                payload.employee_code = payload.employee_code or emp.employee_code
                payload.employee_name = (
                    payload.employee_name or f"{emp.first_name} {emp.last_name}".strip()
                )
        return payload

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [self._enrich(row) for row in self._repo.list_rows(ctx, cid)]

    def get(self, ctx: TenantContext, row_id: UUID) -> PayslipResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payslip not found")
        return self._enrich(row)

    def export_text(self, ctx: TenantContext, row_id: UUID) -> str:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payslip not found")
        meta = row.payslip_json if isinstance(row.payslip_json, dict) else {}
        if meta.get("export_text"):
            return str(meta["export_text"])
        return format_payslip_text(meta) if meta.get("version") else ""

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PayEntityType.PAYSLIP, cid, PayPayslip, "document_number")
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)
        return self._enrich(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payslip not found")
        updated = self._repo.update(ctx, row_id, **fields)
        return self._enrich(updated) if updated else self._enrich(row)

    def issue(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payslip not found")
        self._engine.issue(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        return self._enrich(updated) if updated else self._enrich(row)

    def generate_for_run(
        self,
        ctx: TenantContext,
        payroll_run_id: UUID,
        *,
        issue: bool = False,
    ) -> list[PayslipResponse]:
        run = self._run_repo.get(ctx, payroll_run_id)
        if run is None:
            raise NotFoundException("Payroll run not found")
        if run.status in {PayrollRunStatus.DRAFT.value, PayrollRunStatus.CANCELLED.value}:
            raise AppException("Calculate payroll run before generating payslips")

        period = self._period_repo.get(ctx, run.payroll_period_id)
        if period is None:
            raise NotFoundException("Payroll period not found")

        lines = [
            line
            for line in self._line_repo.list_rows(ctx, run.company_id)
            if line.payroll_run_id == run.id and not getattr(line, "is_deleted", False)
        ]
        if not lines:
            raise AppException("No payroll run lines to generate payslips")

        out: list[PayslipResponse] = []
        for line in lines:
            emp = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == line.employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            breakdown = line.component_breakdown_json if isinstance(line.component_breakdown_json, dict) else {}
            day_summary = line.day_summary_json or breakdown.get("day_summary")

            doc = build_payslip_document(
                period_code=period.period_code,
                period_name=period.period_name,
                period_start=period.start_date,
                period_end=period.end_date,
                employee_id=str(line.employee_id),
                employee_code=emp.employee_code if emp else None,
                employee_name=f"{emp.first_name} {emp.last_name}".strip() if emp else None,
                payroll_run_id=str(run.id),
                payroll_run_line_id=str(line.id),
                paid_days=line.paid_days,
                period_days=line.period_days,
                lop_days=line.lop_days,
                leave_days=line.leave_days,
                gross_earnings=line.gross_earnings,
                total_deductions=line.total_deductions,
                net_pay=line.net_pay,
                employer_contribution=line.employer_contribution,
                component_breakdown=breakdown,
                day_summary=day_summary if isinstance(day_summary, dict) else None,
            )
            doc["employee_name"] = doc["employee"].get("name")
            doc["employee_code"] = doc["employee"].get("code")

            existing = self._repo.get_by_run_line(ctx, line.id)
            if existing is not None:
                updated = self._repo.update(
                    ctx,
                    existing.id,
                    gross_salary=line.gross_earnings,
                    total_deductions=line.total_deductions,
                    net_salary=line.net_pay,
                    payslip_json=doc,
                    status="generated",
                )
                slip = updated or existing
            else:
                doc_no = self._numbers.generate(
                    PayEntityType.PAYSLIP, run.company_id, PayPayslip, "document_number"
                )
                slip = self._repo.create(
                    ctx,
                    company_id=run.company_id,
                    branch_id=line.branch_id,
                    document_number=doc_no,
                    payroll_run_id=run.id,
                    payroll_run_line_id=line.id,
                    employee_id=line.employee_id,
                    payroll_period_id=run.payroll_period_id,
                    gross_salary=line.gross_earnings,
                    total_deductions=line.total_deductions,
                    net_salary=line.net_pay,
                    payslip_json=doc,
                    status="generated",
                )
                self._audit.log_entity_change(
                    tenant_id=ctx.tenant_id,
                    entity_name="pay_payslip",
                    entity_id=slip.id,
                    operation="generate_from_run",
                    performed_by=ctx.user_id,
                )

            if issue and slip.status == "generated":
                self._engine.issue(slip)
                slip = self._repo.update(ctx, slip.id, status=slip.status) or slip

            out.append(self._enrich(slip))

        return out

    def generate_bank_export_for_run(self, ctx: TenantContext, payroll_run_id: UUID) -> str:
        run = self._run_repo.get(ctx, payroll_run_id)
        if run is None:
            raise NotFoundException("Payroll run not found")
        if run.status in {PayrollRunStatus.DRAFT.value, PayrollRunStatus.CANCELLED.value}:
            raise AppException("Payroll run must be calculated before bank export")

        lines = [
            line
            for line in self._line_repo.list_rows(ctx, run.company_id)
            if line.payroll_run_id == run.id and not getattr(line, "is_deleted", False)
        ]
        if not lines:
            raise AppException("No payroll run lines for bank export")

        rows: list[dict] = []
        for line in lines:
            emp = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == line.employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            profile = self._db.scalar(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.employee_id == line.employee_id,
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            )
            slip = self._db.scalar(
                select(PayPayslip).where(
                    PayPayslip.payroll_run_line_id == line.id,
                    PayPayslip.is_deleted.is_(False),
                )
            )
            net = line.net_pay if line.net_pay is not None else (slip.net_salary if slip else 0)
            rows.append(
                {
                    "employee_code": emp.employee_code if emp else "",
                    "employee_name": (
                        f"{emp.first_name} {emp.last_name}".strip() if emp else ""
                    ),
                    "account_number": getattr(profile, "bank_account_number", None) if profile else None,
                    "ifsc": getattr(profile, "bank_ifsc", None) if profile else None,
                    "bank_name": getattr(profile, "bank_name", None) if profile else None,
                    "account_holder": getattr(profile, "bank_account_holder", None) if profile else None,
                    "net_pay": net,
                    "payroll_run_line_id": str(line.id),
                }
            )
        return build_bank_export_csv(rows)
