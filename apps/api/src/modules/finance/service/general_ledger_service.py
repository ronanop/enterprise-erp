"""General ledger service."""

from calendar import month_name
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.repository.coa_repository import COARepository
from modules.finance.repository.fiscal_repository import FiscalRepository
from modules.finance.repository.gl_repository import GLRepository
from modules.finance.schemas import (
    GlAccountLedgerLineResponse,
    GlAccountLedgerResponse,
    GlEntryResponse,
    GlMonthlySummaryResponse,
    GlSummaryResponse,
    GlTrialBalancePreviewLine,
    GlTrialBalancePreviewResponse,
)
from modules.finance.service.engines.ledger_engine import LedgerEngine
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class GeneralLedgerService:
    def __init__(self, db: Session) -> None:
        self._ledger = LedgerEngine(db)
        self._gl = GLRepository(db)
        self._coa = COARepository(db)
        self._fiscal = FiscalRepository(db)
        self._scope = FinanceScopeValidator(db)

    def list_entries(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        account_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        branch_id: UUID | None = None,
        cost_center_id: UUID | None = None,
        currency_code: str | None = None,
        journal_status: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        search: str | None = None,
        sort_by: str = "entry_date",
        sort_dir: str = "asc",
        with_running_balance: bool = False,
    ) -> list[GlEntryResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        entries = self._gl.list_entries(
            ctx,
            cid,
            account_id=account_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            branch_id=branch_id,
            cost_center_id=cost_center_id,
            currency_code=currency_code,
            journal_status=journal_status,
            from_date=from_date,
            to_date=to_date,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        running = Decimal("0")
        # Opening for running balance when filtered to one account
        if with_running_balance and account_id and from_date:
            d, c = self._gl.account_balance_before(ctx, cid, account_id, from_date)
            running = Decimal(str(d)) - Decimal(str(c))
        result: list[GlEntryResponse] = []
        for entry in entries:
            payload = self._to_response(ctx, entry)
            if with_running_balance:
                running += Decimal(str(entry.base_debit_amount)) - Decimal(
                    str(entry.base_credit_amount)
                )
                payload.running_balance = float(running)
            result.append(payload)
        return result

    def get_entry(self, ctx: TenantContext, entry_id: UUID) -> GlEntryResponse:
        entry = self._gl.get_entry(ctx, entry_id)
        if entry is None:
            raise NotFoundException("GL entry not found")
        self._scope.validate_company_access(ctx, entry.company_id)
        return self._to_response(ctx, entry)

    def account_statement(
        self,
        ctx: TenantContext,
        account_id: UUID,
        company_id: UUID | None = None,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._ledger.account_statement(
            ctx, cid, account_id, from_date=from_date, to_date=to_date
        )

    def account_ledger(
        self,
        ctx: TenantContext,
        account_id: UUID,
        company_id: UUID | None = None,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
    ) -> GlAccountLedgerResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        account = self._coa.get_account(ctx, account_id)
        if account is None:
            raise NotFoundException("Account not found")
        self._scope.validate_company_access(ctx, account.company_id)

        open_date = from_date
        if open_date is None and period_id:
            period = self._fiscal.get_period(ctx, period_id)
            if period:
                open_date = period.start_date
        if open_date is None and fiscal_year_id:
            fy = self._fiscal.get_fiscal_year(ctx, fiscal_year_id)
            if fy:
                open_date = fy.start_date

        opening_debit = opening_credit = 0.0
        if open_date:
            opening_debit, opening_credit = self._gl.account_balance_before(
                ctx, cid, account_id, open_date
            )
        opening = opening_debit - opening_credit
        if account.normal_balance == "credit":
            opening = opening_credit - opening_debit

        entries = self._gl.list_entries(
            ctx,
            cid,
            account_id=account_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
            sort_by="entry_date",
            sort_dir="asc",
        )

        running = Decimal(str(opening_debit - opening_credit))
        lines: list[GlAccountLedgerLineResponse] = []
        monthly: dict[tuple[int, int], list[float]] = {}
        journal_ids: list[UUID] = []
        debit_total = credit_total = 0.0

        for entry in entries:
            debit = float(entry.base_debit_amount)
            credit = float(entry.base_credit_amount)
            debit_total += debit
            credit_total += credit
            running += Decimal(str(debit)) - Decimal(str(credit))
            journal = self._gl.get_journal(ctx, entry.journal_header_id)
            lines.append(
                GlAccountLedgerLineResponse(
                    id=entry.id,
                    entry_date=entry.entry_date,
                    entry_number=entry.entry_number,
                    journal_header_id=entry.journal_header_id,
                    journal_number=journal.journal_number if journal else None,
                    description=entry.description,
                    debit_amount=debit,
                    credit_amount=credit,
                    running_balance=float(running),
                )
            )
            key = (entry.entry_date.year, entry.entry_date.month)
            if key not in monthly:
                monthly[key] = [0.0, 0.0]
            monthly[key][0] += debit
            monthly[key][1] += credit
            if entry.journal_header_id not in journal_ids:
                journal_ids.append(entry.journal_header_id)

        closing_raw = float(running)
        closing = closing_raw
        if account.normal_balance == "credit":
            closing = -closing_raw if closing_raw != 0 else 0.0
            # Prefer credit-normal presentation: credit - debit from opening_credit/debit + period
            closing = (opening_credit + credit_total) - (opening_debit + debit_total)

        monthly_summary = [
            GlMonthlySummaryResponse(
                year=y,
                month=m,
                label=f"{month_name[m][:3]}-{y}",
                debit_total=vals[0],
                credit_total=vals[1],
                net=vals[0] - vals[1],
            )
            for (y, m), vals in sorted(monthly.items())
        ]

        return GlAccountLedgerResponse(
            account_id=account.id,
            account_code=account.account_code,
            account_name=account.account_name,
            account_type=account.account_type,
            normal_balance=account.normal_balance,
            status=account.status,
            opening_balance=opening if account.normal_balance == "debit" else (
                (opening_credit - opening_debit)
            ),
            debit_total=debit_total,
            credit_total=credit_total,
            closing_balance=closing if account.normal_balance == "credit" else closing_raw,
            lines=lines,
            monthly_summary=monthly_summary,
            related_journal_ids=journal_ids,
        )

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> GlSummaryResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        today = date.today()
        total_debits, total_credits, _ = self._gl.aggregate_totals(ctx, cid)
        _, _, today_count = self._gl.aggregate_totals(ctx, cid, from_date=today, to_date=today)
        accounts = self._coa.list_accounts(ctx, cid)
        active_ledger = sum(
            1 for a in accounts if a.status == "active" and a.is_posting_account
        )
        current_period = self._fiscal.get_current_period(ctx, cid, today)
        fy = None
        if current_period:
            fy = self._fiscal.get_fiscal_year(ctx, current_period.fiscal_year_id)
        if fy is None:
            fy = self._fiscal.get_open_fiscal_year(ctx, cid)

        return GlSummaryResponse(
            total_accounts=len(accounts),
            active_ledger_accounts=active_ledger,
            total_debits=total_debits,
            total_credits=total_credits,
            current_balance=total_debits - total_credits,
            todays_transactions=today_count,
            current_fiscal_year_code=fy.fiscal_year_code if fy else None,
            current_fiscal_year_id=fy.id if fy else None,
            current_period_name=current_period.period_name if current_period else None,
            current_period_id=current_period.id if current_period else None,
        )

    def trial_balance_preview(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> GlTrialBalancePreviewResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        entries = self._gl.list_entries(
            ctx,
            cid,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        by_account: dict[UUID, dict] = {}
        for entry in entries:
            bucket = by_account.setdefault(
                entry.account_id,
                {
                    "account_code": entry.account_code,
                    "debit": 0.0,
                    "credit": 0.0,
                },
            )
            bucket["debit"] += float(entry.base_debit_amount)
            bucket["credit"] += float(entry.base_credit_amount)

        open_boundary = from_date
        if open_boundary is None and period_id:
            period = self._fiscal.get_period(ctx, period_id)
            if period:
                open_boundary = period.start_date
        if open_boundary is None and fiscal_year_id:
            fy = self._fiscal.get_fiscal_year(ctx, fiscal_year_id)
            if fy:
                open_boundary = fy.start_date

        lines: list[GlTrialBalancePreviewLine] = []
        total_opening = total_debit = total_credit = total_closing = 0.0
        for account_id, vals in sorted(by_account.items(), key=lambda x: x[1]["account_code"]):
            account = self._coa.get_account(ctx, account_id)
            opening = 0.0
            if open_boundary:
                od, oc = self._gl.account_balance_before(ctx, cid, account_id, open_boundary)
                opening = od - oc
            closing = opening + vals["debit"] - vals["credit"]
            lines.append(
                GlTrialBalancePreviewLine(
                    account_id=account_id,
                    account_code=vals["account_code"],
                    account_name=account.account_name if account else vals["account_code"],
                    opening=opening,
                    debit=vals["debit"],
                    credit=vals["credit"],
                    closing=closing,
                )
            )
            total_opening += opening
            total_debit += vals["debit"]
            total_credit += vals["credit"]
            total_closing += closing

        return GlTrialBalancePreviewResponse(
            lines=lines,
            total_opening=total_opening,
            total_debit=total_debit,
            total_credit=total_credit,
            total_closing=total_closing,
            difference=total_debit - total_credit,
        )

    def _to_response(self, ctx: TenantContext, entry) -> GlEntryResponse:
        journal = self._gl.get_journal(ctx, entry.journal_header_id)
        account = self._coa.get_account(ctx, entry.account_id)
        period = self._gl.get_period(ctx, entry.period_id)
        fy = self._gl.get_fiscal_year(ctx, entry.fiscal_year_id)
        return GlEntryResponse(
            id=entry.id,
            entry_number=entry.entry_number,
            entry_date=entry.entry_date,
            account_id=entry.account_id,
            account_code=entry.account_code,
            debit_amount=float(entry.debit_amount),
            credit_amount=float(entry.credit_amount),
            base_debit_amount=float(entry.base_debit_amount),
            base_credit_amount=float(entry.base_credit_amount),
            currency_code=entry.currency_code,
            description=entry.description,
            company_id=entry.company_id,
            branch_id=getattr(entry, "branch_id", None),
            period_id=entry.period_id,
            fiscal_year_id=entry.fiscal_year_id,
            journal_header_id=entry.journal_header_id,
            journal_line_id=entry.journal_line_id,
            cost_center_id=entry.cost_center_id,
            profit_center_id=entry.profit_center_id,
            exchange_rate=float(entry.exchange_rate) if entry.exchange_rate is not None else None,
            is_reversal=bool(entry.is_reversal),
            posted_at=entry.posted_at,
            posted_by=entry.posted_by,
            created_at=entry.created_at,
            account_name=account.account_name if account else None,
            journal_number=journal.journal_number if journal else None,
            journal_status=journal.status if journal else "posted",
            journal_type=journal.journal_type if journal else None,
            workflow_status=journal.workflow_status if journal else None,
            period_name=period.period_name if period else None,
            fiscal_year_code=fy.fiscal_year_code if fy else None,
            cost_center_name=None,
            project_ref=None,
            running_balance=None,
        )
