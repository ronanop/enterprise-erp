"""Project cost service â€” posts via Finance PostingService only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.adapters.finance_port import ProjectFinanceAdapter
from modules.project.domain.enums import PrjEntityType
from modules.project.models import PrjProjectCost
from modules.project.repository.project_cost_repository import ProjectCostRepository
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import ProjectCostEngine
from modules.project.service.project_scope_validator import ProjectScopeValidator


class CostService:
    def __init__(self, db: Session) -> None:
        self._repo = ProjectCostRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ProjectCostEngine()
        self._finance = ProjectFinanceAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjProjectCost:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("CostService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(PrjEntityType.PROJECT_COST, cid, PrjProjectCost, "document_number")
        if not fields.get("idempotency_key"):
            fields["idempotency_key"] = doc
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("CostService not found")
        return row

    def post(
        self,
        ctx: TenantContext,
        row_id: UUID,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        try:
            journal_id = self._finance.post_project_cost(
                ctx,
                row,
                amount=Decimal(str(row.cost_amount)),
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                fiscal_year_id=fiscal_year_id,
            )
            self._engine.post(row)
            return self._repo.update(
                ctx, row_id, status=row.status, finance_journal_id=journal_id
            )
        except Exception:
            self._engine.fail(row)
            self._repo.update(ctx, row_id, status=row.status)
            raise
