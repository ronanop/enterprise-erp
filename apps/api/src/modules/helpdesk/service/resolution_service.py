"""Resolution service — chargeable posts via Finance PostingService only."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.helpdesk.adapters.finance_port import HelpdeskFinanceAdapter
from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.models import HdResolution
from modules.helpdesk.repository.resolution_repository import ResolutionRepository
from modules.helpdesk.service.document_number_service import DocumentNumberService
from modules.helpdesk.service.engines import ResolutionEngine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class ResolutionService:
    def __init__(self, db: Session) -> None:
        self._repo = ResolutionRepository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ResolutionEngine()
        self._finance = HelpdeskFinanceAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HdResolution:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ResolutionService not found")
        return row

    def create(
        self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(HdEntityType.RESOLUTION, cid, HdResolution, "document_number")
        return self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ResolutionService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        chargeable_amount: Decimal | None = None,
        debit_account_id: UUID | None = None,
        credit_account_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        journal_id = None
        if chargeable_amount is not None and debit_account_id and credit_account_id:
            journal_id = self._finance.post_resolution_charge(
                ctx,
                row,
                amount=chargeable_amount,
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                fiscal_year_id=fiscal_year_id,
            )
        resolved_at = row.resolved_at or datetime.now(timezone.utc)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            resolved_at=resolved_at,
            finance_journal_id=journal_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hd_resolution",
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={
                "status": row.status,
                "finance_journal_id": str(journal_id) if journal_id else None,
            },
        )
        return updated
