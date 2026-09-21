"""Rolling cash flow forecast service.

Assembles the forward-looking cash position from three sources: open
receivables and payables (finance's own sub-ledgers), committed purchase
orders, and stock received but not yet delivered (both published by
procurement's ``CashCommitmentService``).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.finance.domain.cash_flow_forecast import (
    DEFAULT_HORIZON_WEEKS,
    DEFAULT_MONTHLY_INTEREST_RATE_PCT,
    CashFlowForecast,
    CashFlowItem,
    StuckStockItem,
    build_forecast,
)
from modules.finance.domain.treasury_suggestions import (
    DEFAULT_OPERATING_BUFFER,
    TreasuryPlan,
    WeeklyBalance,
    build_plan,
)
from modules.finance.models.ledger import FinCustomerLedger, FinVendorLedger
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.finance.service.report_service import ReportService
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.service.cash_commitment_service import CashCommitmentService

AR_INVOICE_TYPES = ("invoice", "debit_note")
AP_INVOICE_TYPES = ("invoice", "credit_note")
OPEN_STATUSES = ("open", "partial")

# Stock younger than this is still in normal transit, not stuck.
STUCK_STOCK_MIN_DAYS = 7


class CashFlowForecastService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = FinanceScopeValidator(db)
        self._reports = ReportService(db)
        self._commitments = CashCommitmentService(db)

    def forecast(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        as_of: date | None = None,
        horizon_weeks: int = DEFAULT_HORIZON_WEEKS,
        monthly_interest_rate_pct: Decimal | None = None,
        include_committed_orders: bool = True,
    ) -> CashFlowForecast:
        cid = self._scope.resolve_company_id(ctx, company_id)
        as_of = as_of or date.today()
        rate = monthly_interest_rate_pct or DEFAULT_MONTHLY_INTEREST_RATE_PCT

        items: list[CashFlowItem] = []
        items.extend(self._receivable_items(ctx, cid))
        items.extend(self._payable_items(ctx, cid))
        if include_committed_orders:
            items.extend(self._committed_order_items(ctx, cid, as_of))

        return build_forecast(
            as_of=as_of,
            opening_balance=self._cash_on_hand(ctx, cid, as_of),
            items=items,
            stuck_stock=self._stuck_stock_items(ctx, cid, as_of),
            horizon_weeks=horizon_weeks,
            monthly_interest_rate_pct=rate,
        )

    def treasury_plan(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        as_of: date | None = None,
        horizon_weeks: int = DEFAULT_HORIZON_WEEKS,
        operating_buffer: Decimal | None = None,
    ) -> TreasuryPlan:
        """What to do with cash that the forecast shows is genuinely spare."""
        forecast = self.forecast(
            ctx,
            company_id=company_id,
            as_of=as_of,
            horizon_weeks=horizon_weeks,
        )
        return build_plan(
            as_of=forecast.as_of,
            opening_balance=forecast.opening_balance,
            weekly_balances=[
                WeeklyBalance(week_number=w.week_number, closing_balance=w.closing_balance)
                for w in forecast.weeks
            ],
            operating_buffer=(
                operating_buffer
                if operating_buffer is not None
                else DEFAULT_OPERATING_BUFFER
            ),
        )

    # ------------------------------------------------------------- inflows

    def _receivable_items(self, ctx: TenantContext, company_id: UUID) -> list[CashFlowItem]:
        stmt = select(FinCustomerLedger).where(
            FinCustomerLedger.tenant_id == ctx.tenant_id,
            FinCustomerLedger.company_id == company_id,
            FinCustomerLedger.is_deleted.is_(False),
            FinCustomerLedger.status.in_(OPEN_STATUSES),
            FinCustomerLedger.balance_amount > 0,
            FinCustomerLedger.document_type.in_(AR_INVOICE_TYPES),
        )
        return [
            CashFlowItem(
                due_date=row.due_date,
                amount=Decimal(str(row.balance_amount)),
                category="receivable",
                reference=row.document_number,
                counterparty=str(row.customer_id),
                document_date=row.document_date,
            )
            for row in self._db.scalars(stmt).all()
        ]

    # ------------------------------------------------------------ outflows

    def _payable_items(self, ctx: TenantContext, company_id: UUID) -> list[CashFlowItem]:
        stmt = select(FinVendorLedger).where(
            FinVendorLedger.tenant_id == ctx.tenant_id,
            FinVendorLedger.company_id == company_id,
            FinVendorLedger.is_deleted.is_(False),
            FinVendorLedger.status.in_(OPEN_STATUSES),
            FinVendorLedger.balance_amount > 0,
            FinVendorLedger.document_type.in_(AP_INVOICE_TYPES),
        )
        return [
            CashFlowItem(
                due_date=row.due_date,
                amount=Decimal(str(row.balance_amount)),
                category="payable",
                reference=row.document_number,
                counterparty=str(row.vendor_id),
                document_date=row.document_date,
            )
            for row in self._db.scalars(stmt).all()
        ]

    def _committed_order_items(
        self, ctx: TenantContext, company_id: UUID, as_of: date
    ) -> list[CashFlowItem]:
        return [
            CashFlowItem(
                due_date=order.expected_payment_date,
                amount=order.amount,
                category="committed_po",
                reference=order.document_number,
                counterparty=str(order.vendor_id),
                document_date=order.document_date,
            )
            for order in self._commitments.list_committed_orders(
                ctx, company_id, as_of=as_of
            )
        ]

    # --------------------------------------------------------- stuck stock

    def _stuck_stock_items(
        self, ctx: TenantContext, company_id: UUID, as_of: date
    ) -> list[StuckStockItem]:
        return [
            StuckStockItem(
                reference=unit.document_number,
                product_name=unit.product_name,
                quantity=unit.quantity,
                value=unit.value,
                received_on=unit.received_on,
                days_held=unit.days_held,
            )
            for unit in self._commitments.list_held_stock(ctx, company_id, as_of=as_of)
            if unit.days_held >= STUCK_STOCK_MIN_DAYS and unit.value > 0
        ]

    # ------------------------------------------------------- opening cash

    def _cash_on_hand(self, ctx: TenantContext, company_id: UUID, as_of: date) -> Decimal:
        """Closing balance across cash and bank accounts, as at `as_of`.

        The statutory cash flow report already classifies those accounts, so the
        opening position is taken from it rather than re-deriving the rule.
        """
        try:
            report = self._reports.cash_flow(
                ctx,
                company_id=company_id,
                from_date=as_of.replace(month=1, day=1),
                to_date=as_of,
            )
        except NotFoundException:
            # No accounting period set up yet - forecast from a zero base.
            return Decimal("0")
        return Decimal(str(report.closing_cash))
