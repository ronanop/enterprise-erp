"""Journal entry service."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.domain.enums import FinanceEntityType, JournalStatus, JournalType
from modules.finance.domain.exceptions import JournalStateError, SegregationOfDutiesError
from modules.finance.models.journal import FinJournalHeader
from modules.finance.repository.coa_repository import COARepository
from modules.finance.repository.fiscal_repository import FiscalRepository
from modules.finance.repository.journal_repository import JournalRepository
from modules.finance.service.document_number_service import DocumentNumberService
from modules.finance.service.engines.journal_engine import JournalEngine
from modules.finance.service.finance_governance_service import FinanceGovernanceService
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class JournalService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = JournalRepository(db)
        self._coa = COARepository(db)
        self._fiscal = FiscalRepository(db)
        self._scope = FinanceScopeValidator(db)
        self._engine = JournalEngine()
        self._numbers = DocumentNumberService(db)
        self._governance = FinanceGovernanceService(db)
        self._audit = AuditService(db)

    def list_journals(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        status: str | None = None,
        journal_type: str | None = None,
        period_id: UUID | None = None,
        search: str | None = None,
        sort_by: str = "journal_date",
        sort_dir: str = "desc",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_journals(
            ctx,
            cid,
            status=status,
            journal_type=journal_type,
            period_id=period_id,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

    def get_journal(self, ctx: TenantContext, journal_id: UUID) -> FinJournalHeader:
        journal = self._repo.get_journal(ctx, journal_id)
        if journal is None:
            raise NotFoundException("Journal not found")
        self._scope.validate_company_access(ctx, journal.company_id)
        self._scope.validate_branch_access(ctx, journal.branch_id)
        return journal

    def create_journal(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        journal_date,
        description: str,
        journal_type: str = JournalType.MANUAL.value,
        currency_code: str = "INR",
        exchange_rate: float = 1.0,
        fiscal_year_id: UUID | None = None,
        period_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        if period_id is None:
            period = self._fiscal.get_period_for_date(ctx, cid, journal_date)
            if period is None:
                raise NotFoundException("No open period for journal date")
            period_id = period.id
            fiscal_year_id = period.fiscal_year_id
        else:
            period = self._fiscal.get_period(ctx, period_id)
            if period is None:
                raise NotFoundException("Period not found")
            fiscal_year_id = period.fiscal_year_id

        self._engine.validate_period_for_journal(period, journal_type)

        journal_number = self._numbers.generate(
            FinanceEntityType.JOURNAL,
            cid,
            model=FinJournalHeader,
            code_column="journal_number",
        )
        journal = self._repo.create_journal(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            journal_number=journal_number,
            journal_date=journal_date,
            journal_type=journal_type,
            description=description,
            fiscal_year_id=fiscal_year_id,
            period_id=period_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            status=JournalStatus.DRAFT.value,
            workflow_status=WorkflowStatus.PENDING.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_header",
            entity_id=journal.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return journal

    def update_journal(
        self,
        ctx: TenantContext,
        journal_id: UUID,
        **fields: object,
    ) -> FinJournalHeader:
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Only draft journals can be edited")

        allowed = {
            "journal_date",
            "description",
            "journal_type",
            "currency_code",
            "exchange_rate",
            "period_id",
            "branch_id",
        }
        payload = {k: v for k, v in fields.items() if k in allowed and v is not None}

        if "branch_id" in payload:
            self._scope.validate_branch_access(ctx, payload["branch_id"])  # type: ignore[arg-type]

        if "period_id" in payload:
            period = self._fiscal.get_period(ctx, payload["period_id"])  # type: ignore[arg-type]
            if period is None:
                raise NotFoundException("Period not found")
            payload["fiscal_year_id"] = period.fiscal_year_id
            self._engine.validate_period_for_journal(
                period, str(payload.get("journal_type") or journal.journal_type)
            )

        updated = self._repo.update_journal(ctx, journal_id, **payload)
        if updated is None:
            raise NotFoundException("Journal not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_header",
            entity_id=journal_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return self.get_journal(ctx, journal_id)

    def add_line(
        self,
        ctx: TenantContext,
        journal_id: UUID,
        *,
        line_number: int,
        account_id: UUID,
        debit_amount: float = 0,
        credit_amount: float = 0,
        description: str | None = None,
        cost_center_id: UUID | None = None,
        tax_id: UUID | None = None,
        customer_id: UUID | None = None,
        vendor_id: UUID | None = None,
    ):
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Lines can only be added to draft journals")

        account = self._coa.get_account(ctx, account_id)
        if account is None:
            raise NotFoundException("Account not found")
        self._engine.validate_posting_account(account)
        self._engine.validate_cost_center(account, cost_center_id)

        rate = Decimal(str(journal.exchange_rate))
        debit = Decimal(str(debit_amount))
        credit = Decimal(str(credit_amount))
        self._engine.validate_amounts(debit_amount, credit_amount)
        base_debit = float((debit * rate).quantize(Decimal("0.0001"))) if debit > 0 else 0
        base_credit = float((credit * rate).quantize(Decimal("0.0001"))) if credit > 0 else 0

        line = self._repo.add_line(
            ctx,
            journal,
            line_number=line_number,
            account_id=account_id,
            description=description,
            debit_amount=float(debit),
            credit_amount=float(credit),
            base_debit_amount=base_debit,
            base_credit_amount=base_credit,
            currency_code=journal.currency_code,
            exchange_rate=journal.exchange_rate,
            cost_center_id=cost_center_id,
            tax_id=tax_id,
            customer_id=customer_id,
            vendor_id=vendor_id,
        )
        journal = self.get_journal(ctx, journal_id)
        totals = self._engine.compute_totals(journal.lines)
        self._engine.apply_totals_to_header(journal, totals)
        return line

    def update_line(
        self,
        ctx: TenantContext,
        journal_id: UUID,
        line_id: UUID,
        **fields: object,
    ):
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Lines can only be edited on draft journals")

        line = self._repo.get_line(ctx, line_id)
        if line is None or line.journal_header_id != journal_id:
            raise NotFoundException("Journal line not found")

        payload = {k: v for k, v in fields.items() if v is not None}
        if "account_id" in payload:
            account = self._coa.get_account(ctx, payload["account_id"])  # type: ignore[arg-type]
            if account is None:
                raise NotFoundException("Account not found")
            self._engine.validate_posting_account(account)
            cost_center_id = payload.get("cost_center_id", line.cost_center_id)
            self._engine.validate_cost_center(account, cost_center_id)  # type: ignore[arg-type]

        debit = float(payload.get("debit_amount", line.debit_amount) or 0)
        credit = float(payload.get("credit_amount", line.credit_amount) or 0)
        self._engine.validate_amounts(debit, credit)
        rate = Decimal(str(journal.exchange_rate))
        payload["debit_amount"] = debit
        payload["credit_amount"] = credit
        payload["base_debit_amount"] = (
            float((Decimal(str(debit)) * rate).quantize(Decimal("0.0001"))) if debit > 0 else 0
        )
        payload["base_credit_amount"] = (
            float((Decimal(str(credit)) * rate).quantize(Decimal("0.0001"))) if credit > 0 else 0
        )

        updated = self._repo.update_line(ctx, line_id, **payload)
        if updated is None:
            raise NotFoundException("Journal line not found")
        journal = self.get_journal(ctx, journal_id)
        totals = self._engine.compute_totals([ln for ln in journal.lines if not ln.is_deleted])
        self._engine.apply_totals_to_header(journal, totals)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_line",
            entity_id=line_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def delete_line(self, ctx: TenantContext, journal_id: UUID, line_id: UUID) -> None:
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Lines can only be deleted on draft journals")
        line = self._repo.get_line(ctx, line_id)
        if line is None or line.journal_header_id != journal_id:
            raise NotFoundException("Journal line not found")
        active = [ln for ln in journal.lines if not ln.is_deleted]
        if len(active) <= 2:
            raise JournalStateError("Journal must keep at least two lines")
        self._repo.soft_delete_line(ctx, line_id)
        journal = self.get_journal(ctx, journal_id)
        totals = self._engine.compute_totals([ln for ln in journal.lines if not ln.is_deleted])
        self._engine.apply_totals_to_header(journal, totals)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_line",
            entity_id=line_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def reorder_lines(self, ctx: TenantContext, journal_id: UUID, line_ids: list[UUID]):
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Lines can only be reordered on draft journals")
        active = {ln.id: ln for ln in journal.lines if not ln.is_deleted}
        if set(line_ids) != set(active.keys()):
            raise JournalStateError("Reorder list must include all active lines exactly once")
        for index, line_id in enumerate(line_ids, start=1):
            self._repo.update_line(ctx, line_id, line_number=index)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_header",
            entity_id=journal_id,
            operation="reorder_lines",
            performed_by=ctx.user_id,
        )
        return self.get_journal(ctx, journal_id)

    def add_comment(self, ctx: TenantContext, journal_id: UUID, comment: str) -> dict:
        journal = self.get_journal(ctx, journal_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="fin_journal_header",
            entity_id=journal.id,
            operation="comment",
            performed_by=ctx.user_id,
            new_value={"comment": comment},
        )
        return {
            "journal_id": str(journal_id),
            "comment": comment,
            "created_by": str(ctx.user_id),
        }

    def submit(self, ctx: TenantContext, journal_id: UUID):
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.DRAFT.value:
            raise JournalStateError("Only draft journals can be submitted")
        totals = self._engine.compute_totals(journal.lines)
        self._engine.validate_balanced(totals)

        instance = self._governance.submit_for_approval(
            ctx, entity_name="fin_journal_header", entity_id=journal_id
        )
        journal.status = JournalStatus.SUBMITTED.value
        journal.workflow_status = WorkflowStatus.IN_PROGRESS.value
        journal.workflow_instance_id = instance.id
        self._repo.update_journal(ctx, journal_id, status=journal.status, workflow_status=journal.workflow_status, workflow_instance_id=instance.id)
        return instance

    def approve(self, ctx: TenantContext, journal_id: UUID):
        journal = self.get_journal(ctx, journal_id)
        if journal.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own journal")
        if journal.workflow_instance_id is None:
            raise JournalStateError("Journal has no workflow instance")

        def on_approved():
            self._repo.update_journal(
                ctx,
                journal_id,
                status=JournalStatus.APPROVED.value,
                workflow_status=WorkflowStatus.APPROVED.value,
            )

        return self._governance.approve(
            ctx,
            instance_id=journal.workflow_instance_id,
            entity_name="fin_journal_header",
            entity_id=journal_id,
            on_approved=on_approved,
        )

    def reject(self, ctx: TenantContext, journal_id: UUID):
        journal = self.get_journal(ctx, journal_id)
        if journal.status != JournalStatus.SUBMITTED.value:
            raise JournalStateError("Only submitted journals can be rejected")
        if journal.workflow_instance_id is None:
            raise JournalStateError("Journal has no workflow instance")

        def on_rejected():
            self._repo.update_journal(
                ctx,
                journal_id,
                status=JournalStatus.DRAFT.value,
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        return self._governance.reject(
            ctx,
            instance_id=journal.workflow_instance_id,
            entity_name="fin_journal_header",
            entity_id=journal_id,
            on_rejected=on_rejected,
        )

    def reverse(self, ctx: TenantContext, journal_id: UUID):
        original = self.get_journal(ctx, journal_id)
        if original.status != JournalStatus.POSTED.value:
            raise JournalStateError("Only posted journals can be reversed")

        reversal = self.create_journal(
            ctx,
            company_id=original.company_id,
            branch_id=original.branch_id,
            journal_date=original.journal_date,
            description=f"Reversal of {original.journal_number}",
            journal_type=JournalType.REVERSAL.value,
            currency_code=original.currency_code,
            exchange_rate=float(original.exchange_rate),
            period_id=original.period_id,
        )
        self._repo.update_journal(ctx, reversal.id, reversal_of_id=original.id)

        for line in [ln for ln in original.lines if not ln.is_deleted]:
            self.add_line(
                ctx,
                reversal.id,
                line_number=line.line_number,
                account_id=line.account_id,
                debit_amount=float(line.credit_amount),
                credit_amount=float(line.debit_amount),
                description=line.description,
                cost_center_id=line.cost_center_id,
                tax_id=line.tax_id,
            )

        original.status = JournalStatus.REVERSED.value
        self._repo.update_journal(ctx, journal_id, status=original.status)
        return reversal
