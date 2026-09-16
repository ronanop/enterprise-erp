"""Procurement finance posting - invoice AP / return debit note."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.domain.enums import JournalStatus, JournalType, SubLedgerDocumentType
from modules.finance.repository.journal_repository import JournalRepository
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.finance.service.vendor_ledger_service import VendorLedgerService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.domain.enums import InvoiceStatus, ReturnStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.repository.invoice_repository import InvoiceRepository
from modules.procurement.repository.return_repository import ReturnRepository
from modules.procurement.service.engines.invoice_engine import InvoiceEngine
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator


class ProcurementPostingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._invoices = InvoiceRepository(db)
        self._returns = ReturnRepository(db)
        self._invoice_engine = InvoiceEngine()
        self._scope = ProcurementScopeValidator(db)
        self._ap = VendorLedgerService(db)
        self._journals = JournalService(db)
        self._journal_repo = JournalRepository(db)
        self._posting = PostingService(db)
        self._audit = AuditService(db)

    def post_invoice(
        self,
        ctx: TenantContext,
        invoice_id: UUID,
        *,
        ap_account_id: UUID,
        expense_account_id: UUID | None = None,
    ):
        invoice = self._invoices.get_invoice_for_update(ctx, invoice_id)
        if invoice is None:
            raise NotFoundException("Invoice not found")
        self._scope.validate_company_access(ctx, invoice.company_id)
        self._invoice_engine.validate_postable(invoice)

        amount = float(invoice.total_amount)
        if amount <= 0:
            raise InvalidDocumentState("Invoice total must be greater than zero")

        expense_id = expense_account_id
        if expense_id is None:
            for line in invoice.lines:
                if line.expense_account_id and not line.is_deleted:
                    expense_id = line.expense_account_id
                    break
        if expense_id is None:
            raise InvalidDocumentState("Expense account is required for posting")

        ap_entry = self._ap.create_entry(
            ctx,
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            vendor_id=invoice.vendor_id,
            document_date=invoice.document_date,
            due_date=invoice.due_date,
            document_type=SubLedgerDocumentType.INVOICE.value,
            debit_amount=0,
            credit_amount=amount,
            currency_code=invoice.currency_code,
            exchange_rate=float(invoice.exchange_rate),
        )

        journal = self._journals.create_journal(
            ctx,
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            journal_date=invoice.document_date,
            description=f"Purchase invoice {invoice.document_number}",
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
            account_id=expense_id,
            debit_amount=amount,
            credit_amount=0,
            description=f"Expense {invoice.document_number}",
            vendor_id=invoice.vendor_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=ap_account_id,
            debit_amount=0,
            credit_amount=amount,
            description=f"AP {invoice.document_number}",
            vendor_id=invoice.vendor_id,
        )
        self._journal_repo.update_journal(
            ctx,
            journal.id,
            status=JournalStatus.APPROVED.value,
        )
        self._posting.post_system_journal(ctx, journal.id)

        updated = self._invoices.update_invoice(
            ctx,
            invoice_id,
            status=InvoiceStatus.POSTED.value,
            finance_ledger_id=ap_entry.id,
            finance_journal_id=journal.id,
            posting_status="posted",
            balance_due=amount,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_invoice_header",
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
        ap_account_id: UUID,
        expense_account_id: UUID,
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

        ap_entry = self._ap.create_entry(
            ctx,
            company_id=header.company_id,
            branch_id=header.branch_id,
            vendor_id=header.vendor_id,
            document_date=header.document_date,
            due_date=header.document_date,
            document_type=SubLedgerDocumentType.DEBIT_NOTE.value,
            debit_amount=amount,
            credit_amount=0,
            currency_code=header.currency_code,
            exchange_rate=float(header.exchange_rate),
        )

        journal = self._journals.create_journal(
            ctx,
            company_id=header.company_id,
            branch_id=header.branch_id,
            journal_date=header.document_date,
            description=f"Purchase return {header.document_number}",
            journal_type=JournalType.SYSTEM.value,
            currency_code=header.currency_code,
            exchange_rate=float(header.exchange_rate),
            period_id=header.period_id,
            fiscal_year_id=header.fiscal_year_id,
        )
        # Reversal: AP Dr, Expense Cr
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=ap_account_id,
            debit_amount=amount,
            credit_amount=0,
            description=f"AP debit {header.document_number}",
            vendor_id=header.vendor_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=expense_account_id,
            debit_amount=0,
            credit_amount=amount,
            description=f"Return expense {header.document_number}",
            vendor_id=header.vendor_id,
        )
        self._journal_repo.update_journal(
            ctx,
            journal.id,
            status=JournalStatus.APPROVED.value,
        )
        self._posting.post_system_journal(ctx, journal.id)

        for line in [ln for ln in header.lines if not ln.is_deleted]:
            line.status = "posted"
        updated = self._returns.update_return(
            ctx,
            return_id,
            status=ReturnStatus.POSTED.value,
            finance_ledger_id=ap_entry.id,
            finance_journal_id=journal.id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_return_header",
            entity_id=return_id,
            operation="post",
            performed_by=ctx.user_id,
            new_value={"finance_ledger_id": str(ap_entry.id)},
        )
        return updated
