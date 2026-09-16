"""Payroll posting - Finance via PostingService only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.payroll.adapters.finance_port import PayrollFinanceAdapter
from modules.payroll.domain.enums import PayEntityType
from modules.payroll.models import PayPayrollPosting
from modules.payroll.repository.payroll_posting_repository import PayrollPostingRepository
from modules.payroll.service.document_number_service import DocumentNumberService
from modules.payroll.service.engines import PayrollPostingEngine
from modules.payroll.service.payroll_scope_validator import PayrollScopeValidator


class PayrollPostingService:
    def __init__(self, db: Session) -> None:
        self._repo = PayrollPostingRepository(db)
        self._scope = PayrollScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PayrollPostingEngine()
        self._finance = PayrollFinanceAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PayPayrollPosting:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Payroll posting not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PayEntityType.PAYROLL_POSTING, cid, PayPayrollPosting, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def post(self, ctx: TenantContext, row_id: UUID, *, debit_account_id: UUID, credit_account_id: UUID):
        row = self.get(ctx, row_id)
        amount = Decimal(str(row.debit_total))
        try:
            jid = self._finance.post_salary_expense(
                ctx,
                row,
                amount=amount,
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
            )
            self._engine.mark_posted(row)
            updated = self._repo.update(
                ctx,
                row_id,
                status=row.status,
                finance_journal_id=jid,
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="pay_payroll_posting",
                entity_id=row_id,
                operation="post",
                performed_by=ctx.user_id,
            )
            return updated
        except Exception as exc:  # noqa: BLE001
            self._engine.mark_failed(row, str(exc))
            return self._repo.update(ctx, row_id, status=row.status, error_message=row.error_message)
