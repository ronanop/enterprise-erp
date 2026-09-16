"""Finance port - JournalService + PostingService.post_system_journal only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayPayrollPosting


class PayrollFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_salary_expense(
        self,
        ctx: TenantContext,
        posting: PayPayrollPosting,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        journal = self._journals.create_journal(
            ctx,
            company_id=posting.company_id,
            branch_id=posting.branch_id,
            journal_date=posting.created_at.date(),
            description=f"Payroll posting {posting.document_number}",
            journal_type=JournalType.SYSTEM.value,
            period_id=posting.period_id,
            fiscal_year_id=fiscal_year_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=debit_account_id,
            debit_amount=float(amount),
            credit_amount=0,
            description="Salary expense",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Payroll liability",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
