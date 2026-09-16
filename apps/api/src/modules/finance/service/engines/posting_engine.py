"""Journal posting engine - atomic GL creation."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from modules.finance.domain.enums import FinanceEntityType, JournalStatus
from modules.finance.domain.exceptions import JournalStateError, PostingError
from modules.finance.models.journal import FinJournalHeader, FinJournalLine
from modules.finance.models.ledger import FinGlEntry
from modules.finance.models.tax import FinTaxRegister
from modules.finance.repository.allocation_repository import AllocationRepository
from modules.finance.repository.coa_repository import COARepository
from modules.finance.repository.code_sequence_repository import CodeSequenceRepository
from modules.finance.repository.gl_repository import GLRepository
from modules.finance.repository.tax_repository import TaxRepository
from modules.finance.service.engines.journal_engine import JournalEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.reference import MasterTax


class PostingEngine:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._gl = GLRepository(db)
        self._coa = COARepository(db)
        self._tax = TaxRepository(db)
        self._allocation = AllocationRepository(db)
        self._codes = CodeSequenceRepository(db)
        self._journal_engine = JournalEngine()

    def post_journal(self, ctx: TenantContext, journal: FinJournalHeader) -> list[FinGlEntry]:
        if journal.status == JournalStatus.POSTED.value:
            raise PostingError("Journal is already posted")
        if journal.status != JournalStatus.APPROVED.value:
            raise JournalStateError("Only approved journals can be posted")
        if self._gl.exists_for_journal(journal.id):
            raise PostingError("GL entries already exist for this journal")

        active_lines = [line for line in journal.lines if not line.is_deleted]
        self._journal_engine.validate_lines_count(active_lines)
        totals = self._journal_engine.compute_totals(active_lines)
        self._journal_engine.validate_balanced(totals)

        gl_entries: list[FinGlEntry] = []
        now = datetime.now(timezone.utc)

        for line in active_lines:
            account = self._coa.get_account(ctx, line.account_id)
            if account is None:
                raise PostingError(f"Account not found for line {line.line_number}")
            self._journal_engine.validate_posting_account(account)

            entry_number = self._codes.next_code(
                FinanceEntityType.GL_ENTRY,
                journal.company_id,
                model=FinGlEntry,
                code_column="entry_number",
            )
            gl_entry = self._gl.create_entry(
                ctx,
                entry_number=entry_number,
                entry_date=journal.journal_date,
                period_id=journal.period_id,
                fiscal_year_id=journal.fiscal_year_id,
                journal_header_id=journal.id,
                journal_line_id=line.id,
                account_id=line.account_id,
                account_code=account.account_code,
                debit_amount=line.debit_amount,
                credit_amount=line.credit_amount,
                base_debit_amount=line.base_debit_amount,
                base_credit_amount=line.base_credit_amount,
                currency_code=line.currency_code,
                exchange_rate=line.exchange_rate,
                description=line.description,
                cost_center_id=line.cost_center_id,
                profit_center_id=line.profit_center_id,
                is_reversal=journal.journal_type == "reversal",
                posted_at=now,
                posted_by=ctx.user_id,
                company_id=journal.company_id,
                branch_id=journal.branch_id,
            )
            gl_entries.append(gl_entry)

            for alloc in self._allocation.list_for_line(ctx, line.id):
                self._allocation.update_gl_entry_id(ctx, alloc.id, gl_entry.id)

            if line.tax_id:
                self._create_tax_register(ctx, journal, line)

        journal.status = JournalStatus.POSTED.value
        journal.posted_at = now
        journal.posted_by = ctx.user_id
        self._db.flush()
        return gl_entries

    def _create_tax_register(
        self,
        ctx: TenantContext,
        journal: FinJournalHeader,
        line: FinJournalLine,
    ) -> None:
        tax = self._db.get(MasterTax, line.tax_id)
        if tax is None:
            return
        register_number = self._codes.next_code(
            FinanceEntityType.TAX_REGISTER,
            journal.company_id,
            model=FinTaxRegister,
            code_column="register_number",
        )
        taxable = float(line.debit_amount or line.credit_amount)
        tax_amount = round(taxable * float(tax.rate_percent) / 100, 4)
        self._tax.create_register(
            ctx,
            register_number=register_number,
            register_date=journal.journal_date,
            tax_id=line.tax_id,
            tax_type=tax.tax_type,
            transaction_type="output" if line.credit_amount > 0 else "input",
            taxable_amount=taxable,
            tax_amount=tax_amount,
            currency_code=line.currency_code,
            journal_header_id=journal.id,
            journal_line_id=line.id,
            customer_id=line.customer_id,
            vendor_id=line.vendor_id,
            source_module=journal.source_module or "finance",
            source_document_id=journal.source_document_id,
            period_id=journal.period_id,
            status="active",
            company_id=journal.company_id,
            branch_id=journal.branch_id,
        )
