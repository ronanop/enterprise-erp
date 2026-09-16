"""Finance port - JournalService + PostingService.post_system_journal only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.project.models import PrjProjectCost


class ProjectFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_project_cost(
        self,
        ctx: TenantContext,
        cost: PrjProjectCost,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        journal = self._journals.create_journal(
            ctx,
            company_id=cost.company_id,
            branch_id=cost.branch_id,
            journal_date=cost.cost_date,
            description=f"Project cost {cost.document_number}",
            journal_type=JournalType.SYSTEM.value,
            fiscal_year_id=fiscal_year_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=debit_account_id,
            debit_amount=float(amount),
            credit_amount=0,
            description="Project cost expense",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Project cost offset",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
