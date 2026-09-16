"""Finance port - JournalService + PostingService.post_system_journal only."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.models import AstAssetDepreciation, AstAssetDisposal, AstAssetRevaluation
from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext


class AssetFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def _post_amount(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        journal_date: date | None,
        description: str,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None,
        debit_desc: str,
        credit_desc: str,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = branch_id if branch_id is not None else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for asset finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=company_id,
            branch_id=resolved_branch_id,
            journal_date=journal_date or date.today(),
            description=description,
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
            description=debit_desc,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description=credit_desc,
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id

    def post_depreciation(
        self,
        ctx: TenantContext,
        row: AstAssetDepreciation,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._post_amount(
            ctx,
            company_id=row.company_id,
            branch_id=getattr(row, "branch_id", None),
            journal_date=date(row.period_year, row.period_month, 1),
            description=f"Asset depreciation {row.document_number}",
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
            debit_desc="Depreciation expense",
            credit_desc="Accumulated depreciation",
        )

    def post_disposal(
        self,
        ctx: TenantContext,
        row: AstAssetDisposal,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._post_amount(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            journal_date=row.disposal_date,
            description=f"Asset disposal {row.document_number}",
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
            debit_desc="Asset disposal debit",
            credit_desc="Asset disposal credit",
        )

    def post_revaluation(
        self,
        ctx: TenantContext,
        row: AstAssetRevaluation,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._post_amount(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            journal_date=row.revaluation_date,
            description=f"Asset revaluation {row.document_number}",
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
            debit_desc="Asset revaluation debit",
            credit_desc="Asset revaluation credit",
        )
