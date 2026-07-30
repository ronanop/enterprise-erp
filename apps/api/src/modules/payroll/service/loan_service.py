"""Loan application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.domain.enums import PayEntityType
from modules.payroll.models import PayLoan
from modules.payroll.repository.loan_repository import LoanRepository
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import LoanEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class LoanService:
    def __init__(self, db: Session) -> None:
        self._repo = LoanRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = LoanEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayLoan:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Loan not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        if fields.get("outstanding_amount") is None and fields.get("principal_amount") is not None:
            fields["outstanding_amount"] = fields["principal_amount"]
        doc = self._numbers.generate(PayEntityType.LOAN, cid, PayLoan, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)
