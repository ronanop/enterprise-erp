"""Separation service — completes via Master Data identity sync; FNF via payroll."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType
from modules.hr.domain.exceptions import InvalidSeparationState
from modules.hr.models import HrSeparation
from modules.hr.repository.separation_repository import SeparationRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import SeparationEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator

DEFAULT_CHECKLIST = [
    {"key": "assets", "label": "Asset return", "done": False, "notes": None},
    {"key": "it", "label": "IT access revocation", "done": False, "notes": None},
    {"key": "finance", "label": "Finance clearance", "done": False, "notes": None},
    {"key": "hr", "label": "HR clearance", "done": False, "notes": None},
    {"key": "exit_interview", "label": "Exit interview", "done": False, "notes": None},
]


def default_clearance() -> dict:
    return {"checklist": [dict(item) for item in DEFAULT_CHECKLIST], "exit_interview": None}


class SeparationService:
    def __init__(self, db: Session) -> None:
        self._repo = SeparationRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = SeparationEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)
        self._db = db

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Separation not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, employee_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        doc = self._numbers.generate(HrEntityType.SEPARATION, cid, HrSeparation, "document_number")
        clearance = fields.pop("clearance_json", None) or default_clearance()
        if "checklist" not in clearance:
            clearance = {**default_clearance(), **clearance}
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            document_number=doc,
            clearance_json=clearance,
            **fields,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        try:
            from modules.hr.service.hr_notify import notify_employee

            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code="hr.separation_submitted",
                template_name="Separation Submitted",
                event_type="hr.separation_submitted",
                title="Separation request submitted",
                body=f"Separation {row.document_number} was submitted and is pending approval.",
                kind="separation",
            )
        except Exception:
            pass
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID, *, stage: str = "manager"):
        row = self.get(ctx, row_id)
        if stage == "manager":
            self._engine.manager_approve(row)
        else:
            self._engine.hr_approve(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        try:
            from modules.hr.service.hr_notify import notify_employee

            label = "manager" if stage == "manager" else "HR"
            notify_employee(
                self._db,
                tenant_id=ctx.tenant_id,
                employee_id=row.employee_id,
                template_code=f"hr.separation_{stage}_approved",
                template_name=f"Separation {label.title()} Approved",
                event_type=f"hr.separation_{stage}_approved",
                title=f"Separation {label}-approved",
                body=f"Separation {row.document_number} was approved by {label}.",
                kind="separation",
            )
        except Exception:
            pass
        return updated

    def _ensure_clearance(self, row: HrSeparation) -> dict:
        clearance = dict(row.clearance_json or {})
        if not isinstance(clearance.get("checklist"), list) or not clearance["checklist"]:
            clearance = {**default_clearance(), **{k: v for k, v in clearance.items() if k != "checklist"}}
            if "exit_interview" not in clearance:
                clearance["exit_interview"] = None
        return clearance

    def update_checklist(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        item_key: str,
        done: bool,
        notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        clearance = self._ensure_clearance(row)
        checklist = list(clearance.get("checklist") or [])
        found = False
        for item in checklist:
            if str(item.get("key")) == item_key:
                item["done"] = bool(done)
                if notes is not None:
                    item["notes"] = notes
                found = True
                break
        if not found:
            raise AppException(f"Unknown checklist item '{item_key}'")
        clearance["checklist"] = checklist
        updated = self._repo.update(ctx, row_id, clearance_json=clearance)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="checklist_update",
            performed_by=ctx.user_id,
            new_value={"item_key": item_key, "done": done},
        )
        return updated

    def save_exit_interview(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        answers: dict,
        interviewer_notes: str | None = None,
    ):
        row = self.get(ctx, row_id)
        clearance = self._ensure_clearance(row)
        clearance["exit_interview"] = {
            "answers": answers,
            "interviewer_notes": interviewer_notes,
            "completed_at": date.today().isoformat(),
            "completed_by": str(ctx.user_id) if ctx.user_id else None,
        }
        for item in clearance.get("checklist") or []:
            if str(item.get("key")) == "exit_interview":
                item["done"] = True
                break
        updated = self._repo.update(ctx, row_id, clearance_json=clearance)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="exit_interview",
            performed_by=ctx.user_id,
        )
        return updated

    def prepare_fnf(self, ctx: TenantContext, row_id: UUID):
        """Create a final_settlement payroll run, calculate salary, add encashment + gratuity."""
        from decimal import Decimal

        from sqlalchemy import select

        from modules.hr.models import HrEmployment
        from modules.hr.service.fnf_amounts import (
            basic_from_gross,
            compute_gratuity,
            compute_leave_encashment,
            daily_rate_from_gross,
        )
        from modules.payroll.models import PayPayrollPeriod, PayPayrollRunLine
        from modules.payroll.service.payroll_run_service import PayrollRunService

        row = self.get(ctx, row_id)
        if row.status not in {"hr_approved", "manager_approved"}:
            raise InvalidSeparationState(
                "FNF can be prepared only after manager or HR approval"
            )
        if row.fnf_status in {"settled", "waived"}:
            raise InvalidSeparationState(f"FNF already {row.fnf_status}")

        period = self._db.scalar(
            select(PayPayrollPeriod)
            .where(
                PayPayrollPeriod.company_id == row.company_id,
                PayPayrollPeriod.is_deleted.is_(False),
                PayPayrollPeriod.status.in_(("open", "processing")),
            )
            .order_by(PayPayrollPeriod.start_date.desc())
        )
        if period is None:
            raise AppException(
                "No open payroll period found — create an open period before preparing FNF"
            )

        lwd = row.approved_last_working_date or row.requested_last_working_date
        pay = PayrollRunService(self._db)
        run = pay.create(
            ctx,
            branch_id=row.branch_id,
            company_id=row.company_id,
            payroll_period_id=period.id,
            run_date=lwd,
            run_type="final_settlement",
            currency_code="INR",
            target_employee_id=row.employee_id,
            status="draft",
        )
        calculated = pay.calculate(ctx, run.id)

        employment = self._db.scalar(
            select(HrEmployment).where(
                HrEmployment.employee_id == row.employee_id,
                HrEmployment.company_id == row.company_id,
                HrEmployment.is_deleted.is_(False),
            )
        )
        line = self._db.scalar(
            select(PayPayrollRunLine).where(
                PayPayrollRunLine.payroll_run_id == calculated.id,
                PayPayrollRunLine.employee_id == row.employee_id,
                PayPayrollRunLine.is_deleted.is_(False),
            )
        )
        gross = Decimal("0")
        if line is not None:
            gross = Decimal(str(line.gross_earnings or 0))
        elif employment is not None and employment.ctc_amount:
            gross = Decimal(str(employment.ctc_amount))

        basic = basic_from_gross(gross)
        rate = daily_rate_from_gross(gross)
        encash_days, encash_amount, encash_details = compute_leave_encashment(
            self._db,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            employee_id=row.employee_id,
            daily_rate=rate,
            apply_usage=True,
        )
        doj = employment.date_of_joining if employment else None
        gratuity_amount, years = compute_gratuity(
            date_of_joining=doj,
            last_working_date=lwd,
            basic=basic,
        )
        extra = encash_amount + gratuity_amount

        total_gross = Decimal(str(calculated.total_gross or 0)) + extra
        total_net = Decimal(str(calculated.total_net or 0)) + extra
        if line is not None:
            breakdown = dict(line.component_breakdown_json or {})
            breakdown["leave_encashment"] = float(encash_amount)
            breakdown["gratuity"] = float(gratuity_amount)
            breakdown["encashment_days"] = float(encash_days)
            breakdown["years_of_service"] = years
            line.component_breakdown_json = breakdown
            line.gross_earnings = Decimal(str(line.gross_earnings or 0)) + extra
            line.net_pay = Decimal(str(line.net_pay or 0)) + extra
            self._db.flush()
        elif extra > 0 and employment is not None:
            from modules.payroll.repository.payroll_run_line_repository import (
                PayrollRunLineRepository,
            )
            from modules.payroll.domain.enums import RunLineStatus

            PayrollRunLineRepository(self._db).create(
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                payroll_run_id=calculated.id,
                employee_id=row.employee_id,
                employee_salary_id=None,
                department_id=None,
                employment_id=employment.id,
                paid_days=Decimal("0"),
                lop_days=Decimal("0"),
                leave_days=Decimal("0"),
                gross_earnings=extra,
                total_deductions=Decimal("0"),
                net_pay=extra,
                employer_contribution=Decimal("0"),
                component_breakdown_json={
                    "leave_encashment": float(encash_amount),
                    "gratuity": float(gratuity_amount),
                    "encashment_days": float(encash_days),
                    "years_of_service": years,
                },
                status=RunLineStatus.CALCULATED.value,
            )
            total_gross = extra
            total_net = extra

        from modules.payroll.repository.payroll_run_repository import PayrollRunRepository

        calculated = PayrollRunRepository(self._db).update(
            ctx,
            calculated.id,
            total_gross=total_gross,
            total_net=total_net,
            employee_count=max(int(calculated.employee_count or 0), 1),
        )

        clearance = dict(row.clearance_json or {})
        clearance["fnf"] = {
            "payroll_run_id": str(calculated.id),
            "document_number": calculated.document_number,
            "total_net": str(calculated.total_net),
            "total_gross": str(calculated.total_gross),
            "leave_encashment_days": str(encash_days),
            "leave_encashment_amount": str(encash_amount),
            "leave_encashment_details": encash_details,
            "gratuity_amount": str(gratuity_amount),
            "years_of_service": years,
            "status": "calculated",
        }
        updated = self._repo.update(
            ctx,
            row_id,
            fnf_status="calculated",
            fnf_payroll_run_id=calculated.id,
            clearance_json=clearance,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="fnf_prepare",
            performed_by=ctx.user_id,
            new_value={
                "fnf_payroll_run_id": str(calculated.id),
                "leave_encashment": str(encash_amount),
                "gratuity": str(gratuity_amount),
            },
        )
        return updated

    def settle_fnf(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.fnf_status not in {"prepared", "calculated"}:
            raise InvalidSeparationState("Prepare FNF before marking it settled")
        clearance = dict(row.clearance_json or {})
        fnf = dict(clearance.get("fnf") or {})
        fnf["status"] = "settled"
        clearance["fnf"] = fnf
        updated = self._repo.update(
            ctx,
            row_id,
            fnf_status="settled",
            clearance_json=clearance,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="fnf_settle",
            performed_by=ctx.user_id,
        )
        return updated

    def waive_fnf(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self.get(ctx, row_id)
        if row.status not in {"hr_approved", "manager_approved"}:
            raise InvalidSeparationState("Waive FNF only after approval")
        clearance = dict(row.clearance_json or {})
        clearance["fnf"] = {"status": "waived", "reason": reason}
        return self._repo.update(
            ctx,
            row_id,
            fnf_status="waived",
            clearance_json=clearance,
        )

    def complete(self, ctx: TenantContext, row_id: UUID, *, approved_last_working_date: date | None = None):
        row = self.get(ctx, row_id)
        if row.fnf_status not in {"settled", "waived", "calculated"}:
            raise InvalidSeparationState(
                "Prepare and calculate FNF (or waive) before completing separation"
            )
        self._engine.complete(row)
        lwd = approved_last_working_date or row.approved_last_working_date or row.requested_last_working_date
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            approved_last_working_date=lwd,
        )
        self._master.complete_separation_identity(
            ctx,
            row.employee_id,
            separation_type=row.separation_type,
            date_of_leaving=lwd,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_separation",
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return updated
