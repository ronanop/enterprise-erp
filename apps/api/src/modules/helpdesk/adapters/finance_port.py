"""Finance port — JournalService + PostingService.post_system_journal only."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.models import HdResolution


class HelpdeskFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_resolution_charge(
        self,
        ctx: TenantContext,
        row: HdResolution,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = row.branch_id if row.branch_id is not None else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for helpdesk finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=row.company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"Helpdesk resolution charge {row.document_number}",
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
            description="Helpdesk resolution debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Helpdesk resolution credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
