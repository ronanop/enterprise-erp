"""Quality finance posting — PostingService.post_system_journal only."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.models import QmCustomerComplaint, QmFinalInspection, QmIncomingInspection


class QualityPostingService:
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

    def post_quality_cost(
        self,
        ctx: TenantContext,
        doc: QmIncomingInspection | QmFinalInspection,
        *,
        amount: Decimal,
        quality_expense_account_id: UUID,
        inventory_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=doc.company_id,
            branch_id=doc.branch_id,
            journal_date=doc.document_date,
            description=f"QM quality cost {getattr(doc, 'document_number', doc.id)}",
            period_id=doc.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=quality_expense_account_id,
            credit_account_id=inventory_account_id,
            amount=amount,
            debit_desc="Quality expense",
            credit_desc="Inventory offset",
        )
        doc.finance_journal_id = jid
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=doc.__tablename__,
            entity_id=doc.id,
            operation="finance_post_quality",
            performed_by=ctx.user_id,
        )
        return jid

    def post_scrap_cost(
        self,
        ctx: TenantContext,
        doc: QmIncomingInspection | QmFinalInspection,
        *,
        amount: Decimal,
        scrap_expense_account_id: UUID,
        inventory_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=doc.company_id,
            branch_id=doc.branch_id,
            journal_date=doc.document_date,
            description=f"QM scrap cost {getattr(doc, 'document_number', doc.id)}",
            period_id=doc.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=scrap_expense_account_id,
            credit_account_id=inventory_account_id,
            amount=amount,
            debit_desc="Scrap expense",
            credit_desc="Inventory credit",
        )
        doc.finance_journal_id = jid
        return jid

    def post_warranty_cost(
        self,
        ctx: TenantContext,
        complaint: QmCustomerComplaint,
        *,
        amount: Decimal,
        warranty_expense_account_id: UUID,
        provision_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        jid = self._post_pair(
            ctx,
            company_id=complaint.company_id,
            branch_id=complaint.branch_id,
            journal_date=complaint.document_date,
            description=f"QM warranty cost {complaint.document_number}",
            period_id=complaint.period_id,
            fiscal_year_id=fiscal_year_id,
            debit_account_id=warranty_expense_account_id,
            credit_account_id=provision_account_id,
            amount=amount,
            debit_desc="Warranty expense",
            credit_desc="Warranty provision",
        )
        complaint.finance_journal_id = jid
        return jid
