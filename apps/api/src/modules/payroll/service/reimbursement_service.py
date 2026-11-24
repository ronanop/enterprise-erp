"""Reimbursement application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.domain.enums import PayEntityType
from modules.payroll.models import PayReimbursement
from modules.payroll.repository.reimbursement_repository import ReimbursementRepository
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import ReimbursementEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class ReimbursementService:
    def __init__(self, db: Session) -> None:
        self._repo = ReimbursementRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ReimbursementEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayReimbursement:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Reimbursement not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PayEntityType.REIMBURSEMENT, cid, PayReimbursement, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        return self._repo.update(ctx, row_id, **fields)

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status == "submitted":
            self._engine.manager_approve(row)
        if row.status == "manager_approved":
            self._engine.finance_approve(row)
        return self._repo.update(ctx, row_id, status=row.status)
