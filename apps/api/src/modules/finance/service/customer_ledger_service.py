"""Customer ledger (AR) service."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.finance.domain.enums import FinanceEntityType
from modules.finance.models.ledger import FinCustomerLedger
from modules.finance.repository.subledger_repository import SubLedgerRepository
from modules.finance.schemas import (
    ArAgingBucket,
    ArAgingReportResponse,
    ArCustomerLedgerLine,
    ArCustomerLedgerResponse,
    ArSummaryResponse,
    CustomerLedgerResponse,
)
from modules.finance.service.document_number_service import DocumentNumberService
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


INVOICE_TYPES = {"invoice", "debit_note"}
RECEIPT_TYPES = {"payment", "receipt"}
ADJUSTMENT_TYPES = {"credit_note", "adjustment", "write_off"}


class CustomerLedgerService:
    def __init__(self, db: Session) -> None:
        self._repo = SubLedgerRepository(db)
        self._scope = FinanceScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)

    def _to_response(self, entry: FinCustomerLedger, customer_map: dict | None = None) -> CustomerLedgerResponse:
        cmap = customer_map or {}
        cust = cmap.get(entry.customer_id)
        debit = float(entry.debit_amount or 0)
        credit = float(entry.credit_amount or 0)
        balance = float(entry.balance_amount or 0)
        paid = credit if entry.document_type in INVOICE_TYPES else (debit if entry.document_type in RECEIPT_TYPES else credit)
        if entry.document_type in INVOICE_TYPES:
            paid = max(debit - balance, 0)
            outstanding = balance
        elif entry.document_type in RECEIPT_TYPES:
            paid = max(credit - balance, 0)
            outstanding = balance  # unallocated
        else:
            outstanding = balance
        days_overdue = None
        if entry.document_type in INVOICE_TYPES and entry.status in ("open", "partial") and balance > 0:
            days_overdue = (date.today() - entry.due_date).days
        data = CustomerLedgerResponse.model_validate(entry)
        return data.model_copy(
            update={
                "customer_code": cust.customer_code if cust else None,
                "customer_name": cust.customer_name if cust else None,
                "outstanding_amount": outstanding,
                "paid_amount": paid,
                "days_overdue": days_overdue,
                "aging_bucket": entry.aging_bucket
                or (
                    self._repo.compute_aging_bucket(entry.due_date, date.today())
                    if entry.document_type in INVOICE_TYPES and balance > 0
                    else entry.aging_bucket
                ),
            }
        )

    def _enrich(self, ctx: TenantContext, entries: list[FinCustomerLedger]) -> list[CustomerLedgerResponse]:
        cmap = self._repo.get_customer_map(ctx, [e.customer_id for e in entries])
        return [self._to_response(e, cmap) for e in entries]

    def list_entries(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        customer_id: UUID | None = None,
        **filters,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_customer_ledger(ctx, cid, customer_id, **filters)

    def list_responses(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        customer_id: UUID | None = None,
        **filters,
    ) -> list[CustomerLedgerResponse]:
        entries = self.list_entries(ctx, company_id, customer_id, **filters)
        return self._enrich(ctx, entries)

    def get_entry(self, ctx: TenantContext, entry_id: UUID) -> CustomerLedgerResponse:
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        return self._enrich(ctx, [entry])[0]

    def create_entry(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        customer_id: UUID,
        document_date: date,
        due_date: date,
        document_type: str,
        debit_amount: float = 0,
        credit_amount: float = 0,
        currency_code: str = "INR",
        exchange_rate: float = 1.0,
        workflow_status: str | None = "draft",
        source_module: str | None = None,
        source_document_id: UUID | None = None,
        status: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc_number = self._numbers.generate(
            FinanceEntityType.CUSTOMER_LEDGER,
            cid,
            model=FinCustomerLedger,
            code_column="document_number",
        )
        if document_type in RECEIPT_TYPES:
            # Unallocated receipt: credit creates positive unallocated balance
            balance = credit_amount - debit_amount
        elif document_type == "allocation":
            balance = 0.0
        else:
            balance = debit_amount - credit_amount
        entry_status = status or ("open" if abs(balance) > 0 else "paid")
        entry = self._repo.create_customer_entry(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            customer_id=customer_id,
            document_number=doc_number,
            document_date=document_date,
            due_date=due_date,
            document_type=document_type,
            debit_amount=debit_amount,
            credit_amount=credit_amount,
            balance_amount=balance,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            status=entry_status,
            workflow_status=workflow_status,
            source_module=source_module,
            source_document_id=source_document_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return entry

    def update_entry(self, ctx: TenantContext, entry_id: UUID, **fields):
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.status in ("cancelled", "written_off"):
            raise AppException("Cannot update cancelled or written-off entry")
        if entry.workflow_status == "approved" and entry.document_type in INVOICE_TYPES:
            raise AppException("Approved invoices cannot be edited")
        payload = {k: v for k, v in fields.items() if v is not None}
        if "debit_amount" in payload or "credit_amount" in payload:
            debit = float(payload.get("debit_amount", entry.debit_amount))
            credit = float(payload.get("credit_amount", entry.credit_amount))
            if entry.document_type in RECEIPT_TYPES:
                allocated = float(entry.credit_amount) - float(entry.balance_amount)
                new_credit = credit
                payload["balance_amount"] = max(new_credit - allocated, 0)
            else:
                paid = float(entry.debit_amount) - float(entry.balance_amount)
                payload["balance_amount"] = max(debit - paid, 0)
                payload["status"] = (
                    "paid"
                    if payload["balance_amount"] <= 0
                    else ("partial" if paid > 0 else "open")
                )
        updated = self._repo.update_customer_entry(ctx, entry_id, **payload)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def record_payment(
        self,
        ctx: TenantContext,
        entry_id: UUID,
        payment_amount: float,
        *,
        receipt_id: UUID | None = None,
    ):
        if payment_amount <= 0:
            raise AppException("Payment amount must be positive")
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.document_type not in INVOICE_TYPES and float(entry.debit_amount or 0) <= 0:
            raise AppException("Payments can only be applied to invoices")
        if entry.status in ("cancelled", "paid", "written_off"):
            raise AppException(f"Cannot pay invoice in status {entry.status}")

        receipt = None
        if receipt_id:
            receipt = self._repo.get_customer_entry(ctx, receipt_id)
            if receipt is None:
                raise NotFoundException("Receipt not found")
            if receipt.document_type not in RECEIPT_TYPES:
                raise AppException("Source document is not a receipt")
            if float(receipt.balance_amount) < payment_amount:
                raise AppException("Insufficient unallocated receipt balance")

        apply_amt = min(payment_amount, float(entry.balance_amount))
        new_balance = float(entry.balance_amount) - apply_amt
        status = "paid" if new_balance <= 0 else "partial"
        updated = self._repo.update_customer_entry(
            ctx,
            entry_id,
            credit_amount=float(entry.credit_amount) + apply_amt,
            balance_amount=max(new_balance, 0),
            status=status,
            aging_bucket=None if new_balance <= 0 else entry.aging_bucket,
        )

        if receipt:
            r_bal = float(receipt.balance_amount) - apply_amt
            self._repo.update_customer_entry(
                ctx,
                receipt_id,
                balance_amount=max(r_bal, 0),
                status="paid" if r_bal <= 0 else "partial",
            )
            self.create_entry(
                ctx,
                company_id=entry.company_id,
                branch_id=entry.branch_id,
                customer_id=entry.customer_id,
                document_date=date.today(),
                due_date=date.today(),
                document_type="allocation",
                debit_amount=0,
                credit_amount=apply_amt,
                currency_code=entry.currency_code,
                exchange_rate=float(entry.exchange_rate or 1),
                workflow_status="approved",
                source_module=f"ar_allocation:{receipt_id}",
                source_document_id=entry.id,
                status="paid",
            )
        else:
            pay = self.create_entry(
                ctx,
                company_id=entry.company_id,
                branch_id=entry.branch_id,
                customer_id=entry.customer_id,
                document_date=date.today(),
                due_date=date.today(),
                document_type="payment",
                debit_amount=0,
                credit_amount=apply_amt,
                currency_code=entry.currency_code,
                exchange_rate=float(entry.exchange_rate or 1),
                workflow_status="approved",
                source_module="ar_payment",
                source_document_id=entry.id,
                status="paid",
            )
            self._repo.update_customer_entry(ctx, pay.id, balance_amount=0, status="paid")

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="payment",
            performed_by=ctx.user_id,
        )
        return updated

    def create_receipt(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        customer_id: UUID,
        document_date: date,
        amount: float,
        currency_code: str = "INR",
        company_id: UUID | None = None,
        exchange_rate: float = 1.0,
        allocate_to_invoice_id: UUID | None = None,
        notes: str | None = None,
    ):
        if amount <= 0:
            raise AppException("Receipt amount must be positive")
        receipt = self.create_entry(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            customer_id=customer_id,
            document_date=document_date,
            due_date=document_date,
            document_type="receipt",
            debit_amount=0,
            credit_amount=amount,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            workflow_status="approved",
            source_module=notes or "ar_receipt",
            status="open",
        )
        # Ensure unallocated balance equals amount
        self._repo.update_customer_entry(ctx, receipt.id, balance_amount=amount, status="open")
        if allocate_to_invoice_id:
            self.record_payment(ctx, allocate_to_invoice_id, amount, receipt_id=receipt.id)
            receipt = self._repo.get_customer_entry(ctx, receipt.id)
        return receipt

    def allocate_receipt(self, ctx: TenantContext, receipt_id: UUID, allocations: list[dict]):
        receipt = self._repo.get_customer_entry(ctx, receipt_id)
        if receipt is None:
            raise NotFoundException("Receipt not found")
        if receipt.document_type not in RECEIPT_TYPES:
            raise AppException("Document is not a receipt")
        results = []
        for line in allocations:
            invoice_id = line["invoice_id"] if isinstance(line, dict) else line.invoice_id
            amount = line["amount"] if isinstance(line, dict) else line.amount
            updated = self.record_payment(ctx, invoice_id, amount, receipt_id=receipt_id)
            results.append(updated)
        return self._repo.get_customer_entry(ctx, receipt_id), results

    def submit(self, ctx: TenantContext, entry_id: UUID):
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.workflow_status not in (None, "draft", "rejected"):
            raise AppException("Only draft entries can be submitted")
        updated = self._repo.update_customer_entry(ctx, entry_id, workflow_status="submitted")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="submit",
            performed_by=ctx.user_id,
        )
        return updated

    def approve(self, ctx: TenantContext, entry_id: UUID):
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.workflow_status not in ("submitted", "draft"):
            raise AppException("Entry must be submitted before approval")
        updated = self._repo.update_customer_entry(ctx, entry_id, workflow_status="approved")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated

    def cancel(self, ctx: TenantContext, entry_id: UUID):
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.status == "paid" and float(entry.credit_amount or 0) > 0 and entry.document_type in INVOICE_TYPES:
            raise AppException("Cannot cancel a paid invoice; reverse payments first")
        updated = self._repo.update_customer_entry(
            ctx,
            entry_id,
            status="cancelled",
            workflow_status="cancelled",
            balance_amount=0,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        return updated

    def reverse(self, ctx: TenantContext, entry_id: UUID):
        entry = self._repo.get_customer_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("AR entry not found")
        if entry.status == "cancelled":
            raise AppException("Entry already cancelled")

        if entry.document_type in RECEIPT_TYPES:
            linked = self._repo.list_customer_ledger(
                ctx,
                entry.company_id,
                entry.customer_id,
                document_type="allocation",
            )
            receipt_tag = f"ar_allocation:{entry_id}"
            for alloc in linked:
                if alloc.source_module != receipt_tag or alloc.status == "cancelled":
                    continue
                if alloc.source_document_id:
                    inv = self._repo.get_customer_entry(ctx, alloc.source_document_id)
                    if inv and inv.status != "cancelled":
                        restore = float(alloc.credit_amount)
                        new_bal = float(inv.balance_amount) + restore
                        self._repo.update_customer_entry(
                            ctx,
                            inv.id,
                            credit_amount=max(float(inv.credit_amount) - restore, 0),
                            balance_amount=new_bal,
                            status="open" if new_bal >= float(inv.debit_amount) else "partial",
                        )
                self._repo.update_customer_entry(
                    ctx, alloc.id, status="cancelled", balance_amount=0, workflow_status="reversed"
                )
            updated = self._repo.update_customer_entry(
                ctx,
                entry_id,
                status="cancelled",
                workflow_status="reversed",
                balance_amount=0,
            )
        elif entry.document_type in INVOICE_TYPES:
            # Reverse invoice: cancel if unpaid; if partial, restore by cancelling and zeroing
            if float(entry.credit_amount or 0) > 0:
                raise AppException("Reverse applied payments before reversing the invoice")
            updated = self._repo.update_customer_entry(
                ctx,
                entry_id,
                status="cancelled",
                workflow_status="reversed",
                balance_amount=0,
            )
        else:
            updated = self._repo.update_customer_entry(
                ctx,
                entry_id,
                status="cancelled",
                workflow_status="reversed",
                balance_amount=0,
            )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_customer_ledger",
            entity_id=entry_id,
            operation="reverse",
            performed_by=ctx.user_id,
        )
        return updated

    def list_invoice_payments(self, ctx: TenantContext, invoice_id: UUID) -> list[CustomerLedgerResponse]:
        rows = self._repo.list_payments_for_invoice(ctx, invoice_id)
        return self._enrich(ctx, rows)

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> ArSummaryResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stats = self._repo.ar_aggregate_stats(ctx, cid)
        aging_entries = self.aging_report(ctx, cid)
        buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        counts = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        for e in aging_entries:
            b = e.aging_bucket or "0-30"
            if b not in buckets:
                b = "90+"
            buckets[b] += float(e.balance_amount or 0)
            counts[b] += 1
        inv_total = stats["invoice_total"] or 0
        collected = stats["month_collections"] or 0
        efficiency = round((collected / inv_total) * 100, 2) if inv_total > 0 else 0.0
        return ArSummaryResponse(
            outstanding_receivables=stats["outstanding"],
            collected_today=stats["collected_today"],
            overdue_invoices=stats["overdue_count"],
            overdue_amount=stats["overdue_amount"],
            current_month_collections=stats["month_collections"],
            customer_count=stats["customer_count"],
            collection_efficiency=efficiency,
            aging=[ArAgingBucket(bucket=k, amount=v, count=counts[k]) for k, v in buckets.items()],
            open_invoice_count=stats["open_invoice_count"],
            receipt_count=stats["receipt_count"],
        )

    def aging_report(self, ctx: TenantContext, company_id: UUID | None = None, as_of: date | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        as_of_date = as_of or date.today()
        entries = self._repo.list_open_ar_for_aging(ctx, cid)
        for entry in entries:
            entry.aging_bucket = self._repo.compute_aging_bucket(entry.due_date, as_of_date)
        return entries

    def aging_report_response(
        self, ctx: TenantContext, company_id: UUID | None = None, as_of: date | None = None
    ) -> ArAgingReportResponse:
        as_of_date = as_of or date.today()
        entries = self.aging_report(ctx, company_id, as_of_date)
        enriched = self._enrich(ctx, entries)
        buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        counts = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        total = 0.0
        for e in enriched:
            b = e.aging_bucket or "0-30"
            if b not in buckets:
                b = "90+"
            amt = float(e.balance_amount or 0)
            buckets[b] += amt
            counts[b] += 1
            total += amt
        return ArAgingReportResponse(
            as_of=as_of_date,
            buckets=[ArAgingBucket(bucket=k, amount=v, count=counts[k]) for k, v in buckets.items()],
            items=enriched,
            total_outstanding=total,
        )

    def customer_ledger(
        self,
        ctx: TenantContext,
        customer_id: UUID,
        company_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> ArCustomerLedgerResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        all_entries = self._repo.list_customer_ledger(
            ctx,
            cid,
            customer_id,
            sort_by="document_date",
            sort_dir="asc",
        )
        cmap = self._repo.get_customer_map(ctx, [customer_id])
        cust = cmap.get(customer_id)

        opening = 0.0
        lines_src = []
        for e in all_entries:
            if e.status == "cancelled":
                continue
            if from_date and e.document_date < from_date:
                opening += float(e.debit_amount or 0) - float(e.credit_amount or 0)
                continue
            if to_date and e.document_date > to_date:
                continue
            lines_src.append(e)

        running = opening
        lines: list[ArCustomerLedgerLine] = []
        invoice_total = receipt_total = adjustment_total = 0.0
        for e in lines_src:
            debit = float(e.debit_amount or 0)
            credit = float(e.credit_amount or 0)
            running += debit - credit
            if e.document_type in INVOICE_TYPES:
                invoice_total += debit
            elif e.document_type in RECEIPT_TYPES or e.document_type == "allocation":
                receipt_total += credit
            else:
                adjustment_total += debit - credit
            lines.append(
                ArCustomerLedgerLine(
                    id=e.id,
                    document_number=e.document_number,
                    document_date=e.document_date,
                    due_date=e.due_date,
                    document_type=e.document_type,
                    debit_amount=debit,
                    credit_amount=credit,
                    balance_amount=float(e.balance_amount or 0),
                    status=e.status,
                    running_balance=running,
                    currency_code=e.currency_code,
                )
            )

        return ArCustomerLedgerResponse(
            customer_id=customer_id,
            customer_code=cust.customer_code if cust else None,
            customer_name=cust.customer_name if cust else None,
            opening_balance=opening,
            closing_balance=running,
            invoice_total=invoice_total,
            receipt_total=receipt_total,
            adjustment_total=adjustment_total,
            lines=lines,
        )
