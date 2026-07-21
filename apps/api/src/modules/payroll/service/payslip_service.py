"""Payslip application service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee
from modules.payroll.domain.enums import PayEntityType
from modules.payroll.models import PayPayslip
from modules.payroll.repository.payslip_repository import PayslipRepository
from modules.payroll.schemas import PayslipResponse
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import PayslipEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayslipService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PayslipRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PayslipEngine()

    def _enrich(self, row: PayPayslip) -> PayslipResponse:
        payload = PayslipResponse.model_validate(row)
        meta = row.payslip_json if isinstance(row.payslip_json, dict) else {}
        if meta.get("employee_name"):
            payload.employee_name = str(meta["employee_name"])
        if meta.get("employee_code"):
            payload.employee_code = str(meta["employee_code"])
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

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PayEntityType.PAYSLIP, cid, PayPayslip, "document_number")
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)
        return self._enrich(row)

    def issue(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payslip not found")
        self._engine.issue(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        return self._enrich(updated) if updated else self._enrich(row)
