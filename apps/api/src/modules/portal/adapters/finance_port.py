"""Finance port — PostingService.post_system_journal only; store finance_journal_id."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.portal.models import PtInvoiceView


class PortalFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def resolve_invoice_ref(self, ctx: TenantContext, finance_invoice_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db if hasattr(self, "_db") else None)
        return finance_invoice_id

    def post_portal_fee(
        self,
        ctx: TenantContext,
        row: PtInvoiceView,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = row.branch_id if hasattr(row, "branch_id") else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for portal finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=row.company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"Portal fee {row.view_number}",
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
            description="Portal fee debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Portal fee credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
