"""Sales finance posting - invoice AR / return credit note."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.domain.enums import JournalStatus, JournalType, SubLedgerDocumentType
from modules.finance.repository.journal_repository import JournalRepository
from modules.finance.service.customer_ledger_service import CustomerLedgerService
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.sales.domain.enums import InvoiceStatus, ReturnStatus
from modules.sales.domain.exceptions import InvalidDocumentState
from modules.sales.repository.credit_repository import CreditRepository
from modules.sales.repository.invoice_repository import InvoiceRepository
from modules.sales.repository.return_repository import ReturnRepository
from modules.sales.service.engines.credit_check_engine import CreditCheckEngine
from modules.sales.service.engines.invoice_engine import InvoiceEngine
from modules.sales.service.sales_scope_validator import SalesScopeValidator


class SalesPostingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._invoices = InvoiceRepository(db)
        self._returns = ReturnRepository(db)
        self._credits = CreditRepository(db)
        self._credit_engine = CreditCheckEngine()
        self._invoice_engine = InvoiceEngine()
        self._scope = SalesScopeValidator(db)
        self._ar = CustomerLedgerService(db)
        self._journals = JournalService(db)
        self._journal_repo = JournalRepository(db)
        self._posting = PostingService(db)
        self._audit = AuditService(db)

    def post_invoice(
        self,
        ctx: TenantContext,
        invoice_id: UUID,
        *,
        ar_account_id: UUID,
        revenue_account_id: UUID | None = None,
    ):
        invoice = self._invoices.get_invoice_for_update(ctx, invoice_id)
        if invoice is None:
            raise NotFoundException("Invoice not found")
        self._scope.validate_company_access(ctx, invoice.company_id)
        self._invoice_engine.validate_postable(invoice)

        amount = float(invoice.total_amount)
        if amount <= 0:
            raise InvalidDocumentState("Invoice total must be greater than zero")

        revenue_id = revenue_account_id
        if revenue_id is None:
            for line in invoice.lines:
                if line.revenue_account_id and not line.is_deleted:
                    revenue_id = line.revenue_account_id
                    break
        if revenue_id is None:
            raise InvalidDocumentState("Revenue account is required for posting")

        ar_entry = self._ar.create_entry(
            ctx,
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            customer_id=invoice.customer_id,
            document_date=invoice.document_date,
            due_date=invoice.due_date,
            document_type=SubLedgerDocumentType.INVOICE.value,
            debit_amount=amount,
            credit_amount=0,
            currency_code=invoice.currency_code,
            exchange_rate=float(invoice.exchange_rate),
        )

        journal = self._journals.create_journal(
            ctx,
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            journal_date=invoice.document_date,
            description=f"Sales invoice {invoice.document_number}",
            journal_type=JournalType.SYSTEM.value,
            currency_code=invoice.currency_code,
            exchange_rate=float(invoice.exchange_rate),
            period_id=invoice.period_id,
            fiscal_year_id=invoice.fiscal_year_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=ar_account_id,
            debit_amount=amount,
            credit_amount=0,
            description=f"AR {invoice.document_number}",
            customer_id=invoice.customer_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=revenue_id,
            debit_amount=0,
            credit_amount=amount,
            description=f"Revenue {invoice.document_number}",
            customer_id=invoice.customer_id,
        )
        self._journal_repo.update_journal(
            ctx,
            journal.id,
            status=JournalStatus.APPROVED.value,
        )
        self._posting.post_system_journal(ctx, journal.id)

        credit = self._credits.get_by_customer(
            ctx, invoice.company_id, invoice.customer_id, branch_id=None
        )
        if credit is not None:
            credit.credit_used = float(
                (Decimal(str(credit.credit_used)) + Decimal(str(amount))).quantize(
                    Decimal("0.0001")
                )
            )
            self._credit_engine.recalculate_available(credit)
            self._credits.update_credit(
                ctx,
                credit.id,
                credit_used=credit.credit_used,
                credit_available=credit.credit_available,
            )

        now = datetime.now(timezone.utc)
        updated = self._invoices.update_invoice(
            ctx,
            invoice_id,
            status=InvoiceStatus.POSTED.value,
            finance_ledger_id=ar_entry.id,
            finance_journal_id=journal.id,
            posting_status="posted",
            posted_at=now,
            posted_by=ctx.user_id,
            balance_due=amount,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sales_invoice_header",
            entity_id=invoice_id,
            operation="post",
            performed_by=ctx.user_id,
        )
        return updated

    def post_return(
        self,
        ctx: TenantContext,
        return_id: UUID,
        *,
        ar_account_id: UUID,
        revenue_account_id: UUID,
    ):
        header = self._returns.get_return_for_update(ctx, return_id)
        if header is None:
            raise NotFoundException("Return not found")
        self._scope.validate_company_access(ctx, header.company_id)
        if header.status not in {
            ReturnStatus.APPROVED.value,
            ReturnStatus.RECEIVED.value,
        }:
            raise InvalidDocumentState("Return cannot be posted in its current state")

        amount = float(header.total_amount)
        if amount <= 0:
            raise InvalidDocumentState("Return total must be greater than zero")

        ar_entry = self._ar.create_entry(
            ctx,
            company_id=header.company_id,
            branch_id=header.branch_id,
            customer_id=header.customer_id,
            document_date=header.document_date,
            due_date=header.document_date,
            document_type=SubLedgerDocumentType.CREDIT_NOTE.value,
            debit_amount=0,
            credit_amount=amount,
            currency_code=header.currency_code,
            exchange_rate=float(header.exchange_rate),
        )

        journal = self._journals.create_journal(
            ctx,
            company_id=header.company_id,
            branch_id=header.branch_id,
            journal_date=header.document_date,
            description=f"Sales return {header.document_number}",
            journal_type=JournalType.SYSTEM.value,
            currency_code=header.currency_code,
            exchange_rate=float(header.exchange_rate),
            period_id=header.period_id,
            fiscal_year_id=header.fiscal_year_id,
        )
        # Reversal: Revenue Dr, AR Cr
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=revenue_account_id,
            debit_amount=amount,
            credit_amount=0,
            description=f"Return revenue {header.document_number}",
            customer_id=header.customer_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=ar_account_id,
            debit_amount=0,
            credit_amount=amount,
            description=f"AR credit {header.document_number}",
            customer_id=header.customer_id,
        )
        self._journal_repo.update_journal(
            ctx,
            journal.id,
            status=JournalStatus.APPROVED.value,
        )
        self._posting.post_system_journal(ctx, journal.id)

        credit = self._credits.get_by_customer(
            ctx, header.company_id, header.customer_id, branch_id=None
        )
        if credit is not None:
            used = Decimal(str(credit.credit_used)) - Decimal(str(amount))
            if used < 0:
                used = Decimal("0")
            credit.credit_used = float(used.quantize(Decimal("0.0001")))
            self._credit_engine.recalculate_available(credit)
            self._credits.update_credit(
                ctx,
                credit.id,
                credit_used=credit.credit_used,
                credit_available=credit.credit_available,
            )

        now = datetime.now(timezone.utc)
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            line.status = "posted"
        updated = self._returns.update_return(
            ctx,
            return_id,
            status=ReturnStatus.POSTED.value,
            finance_journal_id=journal.id,
            posted_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sales_return_header",
            entity_id=return_id,
            operation="post",
            performed_by=ctx.user_id,
            new_value={"finance_ledger_id": str(ar_entry.id)},
        )
        return updated
