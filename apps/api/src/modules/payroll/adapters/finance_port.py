"""Finance port — payroll posting status stays on payroll tables.

Standalone HRMS does not create general-ledger journals.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.models import PayPayrollPosting


class PayrollFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

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
        """Acknowledge a payroll post without writing a finance journal.

        PayrollPostingService records ``posted`` on the payroll posting row.
        The returned id is a local receipt (the posting itself), not a GL key.
        """
        _ = (self._db, ctx, amount, debit_account_id, credit_account_id, fiscal_year_id)
        return posting.id
