"""Tax, currency, asset, and report routers."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.schemas import (
    ApAgingReportResponse,
    ArAgingReportResponse,
    AssetTransactionCreateRequest,
    AssetTransactionResponse,
    BalanceSheetReportResponse,
    CashFlowReportResponse,
    CostCenterSummaryReportResponse,
    CurrencyRateCreateRequest,
    CurrencyRateResponse,
    GlReportResponse,
    JournalRegisterReportResponse,
    ProfitLossReportResponse,
    ReportCatalogItem,
    TaxRegisterResponse,
    TaxSummaryReportResponse,
    TrialBalanceLineResponse,
    TrialBalanceReportResponse,
)
from modules.finance.service.asset_accounting_service import AssetAccountingService
from modules.finance.service.currency_service import CurrencyService
from modules.finance.service.report_service import ReportService
from modules.finance.service.tax_service import TaxService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

tax_register_router = APIRouter(prefix="/tax-register", tags=["Finance - Tax Register"])
currency_rates_router = APIRouter(prefix="/currency-rates", tags=["Finance - Currency Rates"])
asset_transactions_router = APIRouter(prefix="/asset-transactions", tags=["Finance - Asset Transactions"])
reports_router = APIRouter(prefix="/reports", tags=["Finance - Reports"])


@tax_register_router.get("", response_model=APIResponse[list[TaxRegisterResponse]])
def list_tax_register(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.tax:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
) -> APIResponse[list[TaxRegisterResponse]]:
    rows = TaxService(db).list_register(ctx, company_id, period_id)
    return APIResponse(
        message="Tax register retrieved",
        data=[TaxRegisterResponse.model_validate(r) for r in rows],
    )


@currency_rates_router.get("", response_model=APIResponse[list[CurrencyRateResponse]])
def list_currency_rates(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.currency_rate:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[CurrencyRateResponse]]:
    rates = CurrencyService(db).list_rates(ctx, company_id)
    return APIResponse(
        message="Currency rates retrieved",
        data=[CurrencyRateResponse.model_validate(r) for r in rates],
    )


@currency_rates_router.post("", response_model=APIResponse[CurrencyRateResponse])
def create_currency_rate(
    body: CurrencyRateCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.currency_rate:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CurrencyRateResponse]:
    rate = CurrencyService(db).create_rate(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Currency rate created", data=CurrencyRateResponse.model_validate(rate))


@asset_transactions_router.get("", response_model=APIResponse[list[AssetTransactionResponse]])
def list_asset_transactions(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.asset_transaction:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[AssetTransactionResponse]]:
    txns = AssetAccountingService(db).list_transactions(ctx, company_id)
    return APIResponse(
        message="Asset transactions retrieved",
        data=[AssetTransactionResponse.model_validate(t) for t in txns],
    )


@asset_transactions_router.post("", response_model=APIResponse[AssetTransactionResponse])
def create_asset_transaction(
    body: AssetTransactionCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.asset_transaction:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[AssetTransactionResponse]:
    txn = AssetAccountingService(db).create_transaction(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Asset transaction created", data=AssetTransactionResponse.model_validate(txn))


@reports_router.get("/catalog", response_model=APIResponse[list[ReportCatalogItem]])
def report_catalog(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ReportCatalogItem]]:
    _ = ctx
    return APIResponse(message="Report catalog retrieved", data=ReportService(db).catalog())


@reports_router.get("/trial-balance")
def trial_balance(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    period_id: UUID | None = None,
    company_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    branch_id: UUID | None = None,
    full: Annotated[bool, Query()] = False,
) -> APIResponse[TrialBalanceReportResponse | list[TrialBalanceLineResponse]]:
    svc = ReportService(db)
    if full or fiscal_year_id or from_date or to_date:
        data = svc.trial_balance_full(
            ctx,
            company_id=company_id,
            period_id=period_id,
            fiscal_year_id=fiscal_year_id,
            from_date=from_date,
            to_date=to_date,
            branch_id=branch_id,
        )
        return APIResponse(message="Trial balance generated", data=data)
    lines = svc.trial_balance(ctx, period_id, company_id)
    return APIResponse(
        message="Trial balance generated",
        data=[
            TrialBalanceLineResponse(
                account_id=line.account_id,
                account_code=line.account_code,
                account_name=line.account_name,
                debit_total=float(line.debit_total),
                credit_total=float(line.credit_total),
                balance=float(line.balance),
                opening=0,
                closing=float(line.balance),
            )
            for line in lines
        ],
    )


@reports_router.get("/balance-sheet", response_model=APIResponse[BalanceSheetReportResponse])
def balance_sheet(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    as_of: date | None = None,
) -> APIResponse[BalanceSheetReportResponse]:
    data = ReportService(db).balance_sheet(
        ctx,
        company_id=company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        as_of=as_of,
    )
    return APIResponse(message="Balance sheet generated", data=data)


@reports_router.get("/profit-loss", response_model=APIResponse[ProfitLossReportResponse])
def profit_loss(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[ProfitLossReportResponse]:
    data = ReportService(db).profit_loss(
        ctx,
        company_id=company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        from_date=from_date,
        to_date=to_date,
    )
    return APIResponse(message="Profit and loss generated", data=data)


@reports_router.get("/cash-flow", response_model=APIResponse[CashFlowReportResponse])
def cash_flow(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[CashFlowReportResponse]:
    data = ReportService(db).cash_flow(
        ctx,
        company_id=company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        from_date=from_date,
        to_date=to_date,
    )
    return APIResponse(message="Cash flow generated", data=data)


@reports_router.get("/journal-register", response_model=APIResponse[JournalRegisterReportResponse])
def journal_register(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    status: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    q: Annotated[str | None, Query()] = None,
) -> APIResponse[JournalRegisterReportResponse]:
    data = ReportService(db).journal_register(
        ctx,
        company_id=company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        status=status,
        from_date=from_date,
        to_date=to_date,
        q=q,
    )
    return APIResponse(message="Journal register generated", data=data)


@reports_router.get("/general-ledger", response_model=APIResponse[GlReportResponse])
def general_ledger_report(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    account_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    cost_center_id: UUID | None = None,
    currency_code: str | None = None,
    q: Annotated[str | None, Query()] = None,
) -> APIResponse[GlReportResponse]:
    data = ReportService(db).general_ledger_report(
        ctx,
        company_id=company_id,
        account_id=account_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        from_date=from_date,
        to_date=to_date,
        cost_center_id=cost_center_id,
        currency_code=currency_code,
        q=q,
    )
    return APIResponse(message="General ledger report generated", data=data)


@reports_router.get("/tax-summary", response_model=APIResponse[TaxSummaryReportResponse])
def tax_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
) -> APIResponse[TaxSummaryReportResponse]:
    data = ReportService(db).tax_summary(ctx, company_id=company_id, period_id=period_id)
    return APIResponse(message="Tax summary generated", data=data)


@reports_router.get("/cost-center", response_model=APIResponse[CostCenterSummaryReportResponse])
def cost_center_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[CostCenterSummaryReportResponse]:
    data = ReportService(db).cost_center_summary(
        ctx,
        company_id=company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        from_date=from_date,
        to_date=to_date,
    )
    return APIResponse(message="Cost center summary generated", data=data)


@reports_router.get("/ar-aging")
def ar_aging(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    as_of: date | None = None,
    full: Annotated[bool, Query()] = False,
) -> APIResponse[ArAgingReportResponse | list[dict]]:
    svc = ReportService(db)
    if full or as_of:
        return APIResponse(
            message="AR aging report generated",
            data=svc.ar_aging_full(ctx, company_id, as_of),
        )
    entries = svc.ar_aging(ctx, company_id)
    return APIResponse(
        message="AR aging report generated",
        data=[
            {
                "id": str(e.id),
                "customer_id": str(e.customer_id),
                "document_number": e.document_number,
                "due_date": str(e.due_date),
                "balance_amount": float(e.balance_amount),
                "aging_bucket": e.aging_bucket,
            }
            for e in entries
        ],
    )


@reports_router.get("/ap-aging")
def ap_aging(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    as_of: date | None = None,
    full: Annotated[bool, Query()] = False,
) -> APIResponse[ApAgingReportResponse | list[dict]]:
    svc = ReportService(db)
    if full or as_of:
        return APIResponse(
            message="AP aging report generated",
            data=svc.ap_aging_full(ctx, company_id, as_of),
        )
    entries = svc.ap_aging(ctx, company_id)
    return APIResponse(
        message="AP aging report generated",
        data=[
            {
                "id": str(e.id),
                "vendor_id": str(e.vendor_id),
                "document_number": e.document_number,
                "due_date": str(e.due_date),
                "balance_amount": float(e.balance_amount),
                "aging_bucket": e.aging_bucket,
            }
            for e in entries
        ],
    )
