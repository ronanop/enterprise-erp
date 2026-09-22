"""Manufacturing finance posting - PostingService.post_system_journal only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.manufacturing.models.material_issue import MfgMaterialIssue
from modules.manufacturing.models.material_return import MfgMaterialReturn
from modules.manufacturing.models.production_receipt import MfgProductionReceipt
from modules.manufacturing.models.scrap import MfgScrap
from modules.manufacturing.models.variance import MfgVariance


class ManufacturingPostingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._journals = JournalService(db)
        self._posting = PostingService(db)
        self._audit = AuditService(db)

    def _post_pair(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        journal_date,
        description: str,
        period_id: UUID | None,
        fiscal_year_id: UUID | None,
        debit_account_id: UUID,
        credit_account_id: UUID,
        amount: Decimal,
        debit_desc: str,
        credit_desc: str,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        if amount <= 0:
            raise ValueError("Posting amount must be positive")
        journal = self._journals.create_journal(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            journal_date=journal_date,
            description=description,
            journal_type=JournalType.SYSTEM.value,
            period_id=period_id,
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

    def post_material_issue(
        self,
        ctx: TenantContext,
        issue: MfgMaterialIssue,
        *,
        amount: Decimal,
        wip_account_id: UUID,
        inventory_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=issue.company_id,
            branch_id=issue.branch_id,
            journal_date=issue.document_date,
            description=f"MFG material issue {issue.document_number}",
            period_id=issue.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=wip_account_id,
            credit_account_id=inventory_account_id,
            amount=amount,
            debit_desc="WIP material",
            credit_desc="Inventory issue",
        )
        issue.finance_journal_id = jid
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mfg_material_issue",
            entity_id=issue.id,
            operation="finance_post",
            performed_by=ctx.user_id,
        )
        return jid

    def post_material_return(
        self,
        ctx: TenantContext,
        ret: MfgMaterialReturn,
        *,
        amount: Decimal,
        wip_account_id: UUID,
        inventory_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=ret.company_id,
            branch_id=ret.branch_id,
            journal_date=ret.document_date,
            description=f"MFG material return {ret.document_number}",
            period_id=ret.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=inventory_account_id,
            credit_account_id=wip_account_id,
            amount=amount,
            debit_desc="Inventory return",
            credit_desc="WIP relief",
        )
        ret.finance_journal_id = jid
        return jid

    def post_production_receipt(
        self,
        ctx: TenantContext,
        receipt: MfgProductionReceipt,
        *,
        amount: Decimal,
        fg_account_id: UUID,
        wip_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=receipt.company_id,
            branch_id=receipt.branch_id,
            journal_date=receipt.document_date,
            description=f"MFG production receipt {receipt.document_number}",
            period_id=receipt.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=fg_account_id,
            credit_account_id=wip_account_id,
            amount=amount,
            debit_desc="FG inventory",
            credit_desc="WIP relief",
        )
        receipt.finance_journal_id = jid
        return jid

    def post_scrap(
        self,
        ctx: TenantContext,
        scrap: MfgScrap,
        *,
        amount: Decimal,
        scrap_expense_account_id: UUID,
        wip_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=scrap.company_id,
            branch_id=scrap.branch_id,
            journal_date=scrap.document_date,
            description=f"MFG scrap {scrap.document_number}",
            period_id=scrap.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=scrap_expense_account_id,
            credit_account_id=wip_account_id,
            amount=amount,
            debit_desc="Scrap expense",
            credit_desc="WIP / inventory credit",
        )
        scrap.finance_journal_id = jid
        return jid

    def post_variance(
        self,
        ctx: TenantContext,
        variance: MfgVariance,
        *,
        amount: Decimal,
        variance_account_id: UUID,
        wip_account_id: UUID,
        fiscal_year_id: UUID | None = None,
        journal_date=None,
    ) -> UUID:
        amt = abs(amount)
        if amount >= 0:
            debit, credit = variance_account_id, wip_account_id
        else:
            debit, credit = wip_account_id, variance_account_id
        jid = self._post_pair(
            ctx,
            company_id=variance.company_id,
            branch_id=variance.branch_id,
            journal_date=journal_date,
            description=f"MFG variance {variance.variance_type}",
            period_id=variance.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=debit,
            credit_account_id=credit,
            amount=amt,
            debit_desc="Variance",
            credit_desc="WIP offset",
        )
        variance.finance_journal_id = jid
        return jid
