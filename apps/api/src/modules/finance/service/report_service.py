"""Finance reporting service — financial statements and operational reports."""

from __future__ import annotations

import re
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.models.coa import FinChartOfAccount
from modules.finance.models.fiscal import FinFiscalYear, FinPeriod
from modules.finance.schemas import (
    BalanceSheetReportResponse,
    CashFlowReportResponse,
    CashFlowSectionLine,
    CostCenterSummaryLineResponse,
    CostCenterSummaryReportResponse,
    GlReportLineResponse,
    GlReportResponse,
    JournalRegisterLineResponse,
    JournalRegisterReportResponse,
    ProfitLossReportResponse,
    ReportCatalogItem,
    StatementLineResponse,
    TaxSummaryLineResponse,
    TaxSummaryReportResponse,
    TrialBalanceLineResponse,
    TrialBalanceReportResponse,
)
from modules.finance.service.customer_ledger_service import CustomerLedgerService
from modules.finance.service.engines.balance_engine import BalanceEngine
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.finance.service.general_ledger_service import GeneralLedgerService
from modules.finance.service.journal_service import JournalService
from modules.finance.service.tax_service import TaxService
from modules.finance.service.vendor_ledger_service import VendorLedgerService
from modules.foundation.domain.value_objects import TenantContext

CASH_RE = re.compile(r"cash|bank|petty|treasury", re.I)
COGS_RE = re.compile(r"cogs|cost of goods|cost of sales|direct cost", re.I)


class ReportService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._balance = BalanceEngine(db)
        self._scope = FinanceScopeValidator(db)
        self._ar = CustomerLedgerService(db)
        self._ap = VendorLedgerService(db)
        self._gl = GeneralLedgerService(db)
        self._journals = JournalService(db)
        self._tax = TaxService(db)

    def catalog(self) -> list[ReportCatalogItem]:
        return [
            ReportCatalogItem(
                key="trial-balance",
                title="Trial Balance",
                description="Opening, debit, credit, and closing by account",
                href="/finance/reports/trial-balance",
                category="statements",
            ),
            ReportCatalogItem(
                key="balance-sheet",
                title="Balance Sheet",
                description="Assets, liabilities, and equity with period comparison",
                href="/finance/reports/balance-sheet",
                category="statements",
            ),
            ReportCatalogItem(
                key="profit-loss",
                title="Profit & Loss",
                description="Revenue, COGS, expenses, and net profit",
                href="/finance/reports/profit-loss",
                category="statements",
            ),
            ReportCatalogItem(
                key="cash-flow",
                title="Cash Flow",
                description="Operating, investing, and financing cash movements",
                href="/finance/reports/cash-flow",
                category="statements",
            ),
            ReportCatalogItem(
                key="general-ledger",
                title="General Ledger Report",
                description="Printable GL with account and date filters",
                href="/finance/reports/general-ledger",
                category="ledger",
            ),
            ReportCatalogItem(
                key="journal-register",
                title="Journal Register",
                description="Journal listing with voucher and workflow status",
                href="/finance/reports/journal-register",
                category="ledger",
            ),
            ReportCatalogItem(
                key="ar-aging",
                title="AR Aging Report",
                description="Receivable aging by customer bucket",
                href="/finance/reports/ar-aging",
                category="subledger",
            ),
            ReportCatalogItem(
                key="ap-aging",
                title="AP Aging Report",
                description="Payable aging by vendor bucket",
                href="/finance/reports/ap-aging",
                category="subledger",
            ),
            ReportCatalogItem(
                key="tax-summary",
                title="Tax Summary",
                description="Taxable and tax amounts by type",
                href="/finance/reports/tax-summary",
                category="compliance",
            ),
            ReportCatalogItem(
                key="cost-center",
                title="Cost Center Summary",
                description="Debit/credit totals by cost center",
                href="/finance/reports/cost-center",
                category="analytics",
            ),
        ]

    def _default_period_id(self, ctx: TenantContext, company_id: UUID) -> UUID:
        stmt = (
            select(FinPeriod)
            .where(
                FinPeriod.tenant_id == ctx.tenant_id,
                FinPeriod.company_id == company_id,
                FinPeriod.is_deleted.is_(False),
            )
            .order_by(FinPeriod.period_number.desc())
        )
        period = self._db.scalars(stmt).first()
        if period is None:
            raise NotFoundException("No accounting period found for report")
        return period.id

    def _get_period(self, ctx: TenantContext, period_id: UUID) -> FinPeriod | None:
        stmt = select(FinPeriod).where(
            FinPeriod.id == period_id,
            FinPeriod.tenant_id == ctx.tenant_id,
            FinPeriod.is_deleted.is_(False),
        )
        return self._db.scalar(stmt)

    def _previous_period(self, ctx: TenantContext, period: FinPeriod) -> FinPeriod | None:
        stmt = (
            select(FinPeriod)
            .where(
                FinPeriod.tenant_id == ctx.tenant_id,
                FinPeriod.company_id == period.company_id,
                FinPeriod.fiscal_year_id == period.fiscal_year_id,
                FinPeriod.period_number < period.period_number,
                FinPeriod.is_deleted.is_(False),
            )
            .order_by(FinPeriod.period_number.desc())
        )
        prev = self._db.scalars(stmt).first()
        if prev:
            return prev
        # Prior fiscal year last period
        fy_stmt = (
            select(FinFiscalYear)
            .where(
                FinFiscalYear.tenant_id == ctx.tenant_id,
                FinFiscalYear.company_id == period.company_id,
                FinFiscalYear.end_date < period.start_date,
                FinFiscalYear.is_deleted.is_(False),
            )
            .order_by(FinFiscalYear.end_date.desc())
        )
        prev_fy = self._db.scalars(fy_stmt).first()
        if not prev_fy:
            return None
        p_stmt = (
            select(FinPeriod)
            .where(
                FinPeriod.fiscal_year_id == prev_fy.id,
                FinPeriod.is_deleted.is_(False),
            )
            .order_by(FinPeriod.period_number.desc())
        )
        return self._db.scalars(p_stmt).first()

    def _account_map(self, ctx: TenantContext, company_id: UUID) -> dict[UUID, FinChartOfAccount]:
        stmt = select(FinChartOfAccount).where(
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.company_id == company_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return {a.id: a for a in self._db.scalars(stmt).all()}

    def _signed_closing(self, closing_raw: float, account_type: str | None, normal_balance: str | None) -> float:
        """Present balance in statement natural sign (assets/expenses positive when debit)."""
        if normal_balance == "credit":
            return -closing_raw
        if account_type in ("liability", "equity", "revenue"):
            return -closing_raw
        return closing_raw

    def trial_balance(
        self,
        ctx: TenantContext,
        period_id: UUID | None = None,
        company_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        pid = period_id or self._default_period_id(ctx, cid)
        return self._balance.trial_balance(ctx, cid, pid)

    def trial_balance_full(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        branch_id: UUID | None = None,
    ) -> TrialBalanceReportResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        preview = self._gl.trial_balance_preview(
            ctx,
            cid,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        amap = self._account_map(ctx, cid)
        lines: list[TrialBalanceLineResponse] = []
        for line in preview.lines:
            acct = amap.get(line.account_id)
            lines.append(
                TrialBalanceLineResponse(
                    account_id=line.account_id,
                    account_code=line.account_code,
                    account_name=line.account_name,
                    debit_total=line.debit,
                    credit_total=line.credit,
                    balance=line.closing,
                    opening=line.opening,
                    closing=line.closing,
                    account_type=acct.account_type if acct else None,
                )
            )
        # Optional branch filter already applied inside GL list via tenant context; ignore branch_id param if not in GL preview
        _ = branch_id
        return TrialBalanceReportResponse(
            lines=lines,
            total_opening=preview.total_opening,
            total_debit=preview.total_debit,
            total_credit=preview.total_credit,
            total_closing=preview.total_closing,
            difference=preview.difference,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )

    def _closing_by_account(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> dict[UUID, tuple[float, FinChartOfAccount | None]]:
        tb = self.trial_balance_full(
            ctx,
            company_id=company_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        amap = self._account_map(ctx, company_id)
        result: dict[UUID, tuple[float, FinChartOfAccount | None]] = {}
        for line in tb.lines:
            acct = amap.get(line.account_id)
            signed = self._signed_closing(
                line.closing,
                acct.account_type if acct else None,
                acct.normal_balance if acct else None,
            )
            result[line.account_id] = (signed, acct)
        return result

    def balance_sheet(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        as_of: date | None = None,
    ) -> BalanceSheetReportResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        pid = period_id
        period = self._get_period(ctx, pid) if pid else None
        if period is None and not as_of and not fiscal_year_id:
            pid = self._default_period_id(ctx, cid)
            period = self._get_period(ctx, pid)

        to_date = as_of or (period.end_date if period else date.today())
        current = self._closing_by_account(
            ctx,
            cid,
            period_id=pid,
            fiscal_year_id=fiscal_year_id or (period.fiscal_year_id if period else None),
            to_date=to_date if not pid else None,
            from_date=None,
        )

        prev_period = self._previous_period(ctx, period) if period else None
        previous: dict[UUID, tuple[float, FinChartOfAccount | None]] = {}
        previous_as_of = None
        if prev_period:
            previous = self._closing_by_account(ctx, cid, period_id=prev_period.id)
            previous_as_of = prev_period.end_date
        elif as_of:
            previous = self._closing_by_account(
                ctx, cid, to_date=as_of - timedelta(days=1), from_date=None
            )
            previous_as_of = as_of - timedelta(days=1)

        def build_section(atypes: set[str]) -> tuple[list[StatementLineResponse], float, float]:
            lines: list[StatementLineResponse] = []
            total = prev_total = 0.0
            ids = sorted(
                [aid for aid, (_, acct) in current.items() if acct and acct.account_type in atypes],
                key=lambda i: (current[i][1].account_code if current[i][1] else ""),
            )
            for aid in ids:
                amt, acct = current[aid]
                prev_amt = previous.get(aid, (0.0, None))[0]
                if abs(amt) < 0.0001 and abs(prev_amt) < 0.0001:
                    continue
                total += amt
                prev_total += prev_amt
                lines.append(
                    StatementLineResponse(
                        account_id=aid,
                        account_code=acct.account_code if acct else None,
                        account_name=acct.account_name if acct else str(aid),
                        account_type=acct.account_type if acct else None,
                        amount=amt,
                        previous_amount=prev_amt,
                        variance=amt - prev_amt,
                        section=acct.account_type if acct else None,
                    )
                )
            return lines, total, prev_total

        assets, total_assets, prev_assets = build_section({"asset"})
        liabilities, total_liab, prev_liab = build_section({"liability"})
        equity, total_eq, prev_eq = build_section({"equity"})

        # Retained earnings plug from P&L net if equity doesn't balance
        pl = self.profit_loss(ctx, company_id=cid, period_id=pid, fiscal_year_id=fiscal_year_id)
        if abs(pl.net_profit) > 0.0001:
            equity.append(
                StatementLineResponse(
                    account_name="Current Period Net Profit/(Loss)",
                    account_type="equity",
                    amount=pl.net_profit,
                    previous_amount=pl.previous_net_profit,
                    variance=pl.net_profit - pl.previous_net_profit,
                    section="equity",
                    is_total=False,
                )
            )
            total_eq += pl.net_profit
            prev_eq += pl.previous_net_profit

        return BalanceSheetReportResponse(
            assets=assets,
            liabilities=liabilities,
            equity=equity,
            total_assets=total_assets,
            total_liabilities=total_liab,
            total_equity=total_eq,
            previous_total_assets=prev_assets,
            previous_total_liabilities=prev_liab,
            previous_total_equity=prev_eq,
            as_of=to_date,
            previous_as_of=previous_as_of,
        )

    def profit_loss(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> ProfitLossReportResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        period = self._get_period(ctx, period_id) if period_id else None
        if period and not from_date and not to_date:
            from_date = period.start_date
            to_date = period.end_date

        current_tb = self.trial_balance_full(
            ctx,
            company_id=cid,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        amap = self._account_map(ctx, cid)

        prev_tb_lines: list[TrialBalanceLineResponse] = []
        if period:
            prev = self._previous_period(ctx, period)
            if prev:
                prev_tb_lines = self.trial_balance_full(ctx, company_id=cid, period_id=prev.id).lines
        prev_map = {l.account_id: l for l in prev_tb_lines}

        revenue: list[StatementLineResponse] = []
        cogs: list[StatementLineResponse] = []
        opex: list[StatementLineResponse] = []
        total_rev = total_cogs = total_opex = 0.0
        prev_rev = prev_cogs = prev_opex = 0.0

        for line in current_tb.lines:
            acct = amap.get(line.account_id)
            if not acct:
                continue
            signed = self._signed_closing(line.closing - line.opening, acct.account_type, acct.normal_balance)
            _ = signed
            if acct.account_type == "revenue":
                movement = line.credit - line.debit
            elif acct.account_type == "expense":
                movement = line.debit - line.credit
            else:
                continue
            prev_line = prev_map.get(line.account_id)
            if prev_line and acct.account_type == "revenue":
                prev_mov = prev_line.credit_total - prev_line.debit_total
            elif prev_line and acct.account_type == "expense":
                prev_mov = prev_line.debit_total - prev_line.credit_total
            else:
                prev_mov = 0.0

            if abs(movement) < 0.0001 and abs(prev_mov) < 0.0001:
                continue

            row = StatementLineResponse(
                account_id=line.account_id,
                account_code=line.account_code,
                account_name=line.account_name,
                account_type=acct.account_type,
                amount=movement,
                previous_amount=prev_mov,
                variance=movement - prev_mov,
            )
            if acct.account_type == "revenue":
                revenue.append(row)
                total_rev += movement
                prev_rev += prev_mov
            elif COGS_RE.search(f"{acct.account_code} {acct.account_name}"):
                cogs.append(row)
                total_cogs += movement
                prev_cogs += prev_mov
            else:
                opex.append(row)
                total_opex += movement
                prev_opex += prev_mov

        gross = total_rev - total_cogs
        prev_gross = prev_rev - prev_cogs
        op_income = gross - total_opex
        prev_op = prev_gross - prev_opex
        net = op_income
        prev_net = prev_op

        return ProfitLossReportResponse(
            revenue=revenue,
            cogs=cogs,
            operating_expenses=opex,
            total_revenue=total_rev,
            total_cogs=total_cogs,
            gross_profit=gross,
            total_operating_expenses=total_opex,
            operating_income=op_income,
            net_profit=net,
            previous_total_revenue=prev_rev,
            previous_gross_profit=prev_gross,
            previous_operating_income=prev_op,
            previous_net_profit=prev_net,
            from_date=from_date,
            to_date=to_date,
        )

    def cash_flow(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> CashFlowReportResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        period = self._get_period(ctx, period_id) if period_id else None
        if period and not from_date and not to_date:
            from_date = period.start_date
            to_date = period.end_date
        if not to_date:
            to_date = date.today()
        if not from_date:
            from_date = to_date.replace(month=1, day=1) if to_date.month >= 1 else to_date

        pl = self.profit_loss(
            ctx,
            company_id=cid,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        tb = self.trial_balance_full(
            ctx,
            company_id=cid,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        amap = self._account_map(ctx, cid)

        opening_cash = closing_cash = 0.0
        investing_net = financing_net = 0.0
        for line in tb.lines:
            acct = amap.get(line.account_id)
            if not acct:
                continue
            label = f"{acct.account_code} {acct.account_name}"
            is_cash = bool(CASH_RE.search(label))
            period_mov = line.debit - line.credit  # raw debit net
            if is_cash and acct.account_type == "asset":
                opening_cash += line.opening
                closing_cash += line.closing
            elif acct.account_type == "asset" and not is_cash:
                # Capex / investing: increase in assets uses cash
                investing_net -= period_mov
            elif acct.account_type in ("liability", "equity") and acct.account_type:
                financing_net += -period_mov  # credit increase = cash in for financing

        # Working capital memo (Δ not tracked historically in this sprint — show 0)
        operating = [
            CashFlowSectionLine(label="Net Profit/(Loss)", amount=pl.net_profit),
            CashFlowSectionLine(label="Change in Receivables", amount=0.0),
            CashFlowSectionLine(label="Change in Payables", amount=0.0),
        ]
        expected_change = closing_cash - opening_cash
        net_investing = investing_net
        net_financing = financing_net
        net_operating = expected_change - net_investing - net_financing
        operating.append(
            CashFlowSectionLine(label="Other operating adjustments", amount=net_operating - pl.net_profit)
        )

        investing = [CashFlowSectionLine(label="Net investing activities", amount=net_investing)]
        financing = [CashFlowSectionLine(label="Net financing activities", amount=net_financing)]

        return CashFlowReportResponse(
            operating=operating,
            investing=investing,
            financing=financing,
            net_operating=net_operating,
            net_investing=net_investing,
            net_financing=net_financing,
            net_change=expected_change,
            opening_cash=opening_cash,
            closing_cash=closing_cash,
            from_date=from_date,
            to_date=to_date,
        )

    def journal_register(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        status: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        q: str | None = None,
    ) -> JournalRegisterReportResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        journals = self._journals.list_journals(
            ctx,
            company_id=cid,
            period_id=period_id,
            status=status,
            search=q,
        )
        items: list[JournalRegisterLineResponse] = []
        total_debit = total_credit = 0.0
        for j in journals:
            if fiscal_year_id and getattr(j, "fiscal_year_id", None) != fiscal_year_id:
                continue
            jdate = getattr(j, "journal_date", None)
            if from_date and jdate and jdate < from_date:
                continue
            if to_date and jdate and jdate > to_date:
                continue
            debit = float(getattr(j, "total_debit", 0) or 0)
            credit = float(getattr(j, "total_credit", 0) or 0)
            total_debit += debit
            total_credit += credit
            items.append(
                JournalRegisterLineResponse(
                    id=j.id,
                    journal_number=j.journal_number,
                    journal_date=jdate,
                    journal_type=getattr(j, "journal_type", None),
                    reference=getattr(j, "reference_number", None) or getattr(j, "reference", None),
                    description=getattr(j, "description", None),
                    status=j.status,
                    workflow_status=getattr(j, "workflow_status", None),
                    total_debit=debit,
                    total_credit=credit,
                    currency_code=getattr(j, "currency_code", None),
                    period_id=getattr(j, "period_id", None),
                    fiscal_year_id=getattr(j, "fiscal_year_id", None),
                    created_by=getattr(j, "created_by", None),
                )
            )
        return JournalRegisterReportResponse(
            items=items,
            total=len(items),
            total_debit=total_debit,
            total_credit=total_credit,
        )

    def general_ledger_report(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        account_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        cost_center_id: UUID | None = None,
        currency_code: str | None = None,
        q: str | None = None,
    ) -> GlReportResponse:
        entries = self._gl.list_entries(
            ctx,
            company_id,
            account_id=account_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            cost_center_id=cost_center_id,
            currency_code=currency_code,
            from_date=from_date,
            to_date=to_date,
            search=q,
            sort_by="entry_date",
            sort_dir="asc",
        )
        items = [
            GlReportLineResponse(
                id=e.id,
                entry_number=e.entry_number,
                entry_date=e.entry_date,
                account_id=e.account_id,
                account_code=e.account_code,
                account_name=e.account_name,
                journal_number=e.journal_number,
                journal_header_id=e.journal_header_id,
                description=e.description,
                debit_amount=e.base_debit_amount,
                credit_amount=e.base_credit_amount,
                cost_center_id=e.cost_center_id,
                currency_code=e.currency_code,
                journal_status=e.journal_status,
            )
            for e in entries
        ]
        return GlReportResponse(
            items=items,
            total=len(items),
            total_debit=sum(i.debit_amount for i in items),
            total_credit=sum(i.credit_amount for i in items),
        )

    def tax_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
    ) -> TaxSummaryReportResponse:
        rows = self._tax.list_register(ctx, company_id, period_id)
        buckets: dict[tuple[str, str], TaxSummaryLineResponse] = {}
        for r in rows:
            key = (r.tax_type, r.transaction_type)
            line = buckets.get(key)
            if line is None:
                line = TaxSummaryLineResponse(tax_type=r.tax_type, transaction_type=r.transaction_type)
                buckets[key] = line
            line.taxable_amount += float(r.taxable_amount or 0)
            line.tax_amount += float(r.tax_amount or 0)
            line.count += 1
        lines = list(buckets.values())
        return TaxSummaryReportResponse(
            lines=lines,
            total_taxable=sum(l.taxable_amount for l in lines),
            total_tax=sum(l.tax_amount for l in lines),
        )

    def cost_center_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> CostCenterSummaryReportResponse:
        entries = self._gl.list_entries(
            ctx,
            company_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
        )
        buckets: dict[UUID | None, CostCenterSummaryLineResponse] = {}
        for e in entries:
            cc = e.cost_center_id
            line = buckets.get(cc)
            if line is None:
                line = CostCenterSummaryLineResponse(
                    cost_center_id=cc,
                    cost_center_name=e.cost_center_name or ("Unassigned" if cc is None else str(cc)),
                )
                buckets[cc] = line
            line.debit_total += float(e.base_debit_amount or 0)
            line.credit_total += float(e.base_credit_amount or 0)
            line.entry_count += 1
            line.net = line.debit_total - line.credit_total
        lines = sorted(buckets.values(), key=lambda x: x.cost_center_name or "")
        return CostCenterSummaryReportResponse(
            lines=lines,
            total_debit=sum(l.debit_total for l in lines),
            total_credit=sum(l.credit_total for l in lines),
        )

    def ar_aging(self, ctx: TenantContext, company_id: UUID | None = None):
        return self._ar.aging_report(ctx, company_id)

    def ap_aging(self, ctx: TenantContext, company_id: UUID | None = None):
        return self._ap.aging_report(ctx, company_id)

    def ar_aging_full(self, ctx: TenantContext, company_id: UUID | None = None, as_of: date | None = None):
        return self._ar.aging_report_response(ctx, company_id, as_of)

    def ap_aging_full(self, ctx: TenantContext, company_id: UUID | None = None, as_of: date | None = None):
        return self._ap.aging_report_response(ctx, company_id, as_of)
