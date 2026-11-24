"""Service expense service — posts via Finance PostingService only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.service.adapters.finance_port import ServiceFinanceAdapter
from modules.service.domain.enums import SvcEntityType
from modules.service.models import SvcServiceExpense
from modules.service.repository.service_expense_repository import ServiceExpenseRepository
from modules.service.service.document_number_service import DocumentNumberService
from modules.service.service.engines import ServiceExpenseEngine
from modules.service.service.service_scope_validator import ServiceScopeValidator


class ServiceExpenseService:
    def __init__(self, db: Session) -> None:
        self._repo = ServiceExpenseRepository(db)
        self._scope = ServiceScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ServiceExpenseEngine()
        self._finance = ServiceFinanceAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> SvcServiceExpense:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ServiceExpenseService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(SvcEntityType.EXPENSE, cid, SvcServiceExpense, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ServiceExpenseService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def post(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        journal_id = self._finance.post_expense(
            ctx,
            row,
            amount=Decimal(str(row.amount)),
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )
        self._engine.post(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            finance_journal_id=journal_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_expense",
            entity_id=row_id,
            operation="post",
            performed_by=ctx.user_id,
            new_value={"finance_journal_id": str(journal_id), "status": row.status},
        )
        return updated
