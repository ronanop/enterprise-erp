"""General ledger routers."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.dependencies import PaginationParams, get_pagination, paginate
from modules.finance.schemas import (
    GlAccountLedgerResponse,
    GlEntryListResponse,
    GlEntryResponse,
    GlSummaryResponse,
    GlTrialBalancePreviewResponse,
)
from modules.finance.service.general_ledger_service import GeneralLedgerService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

gl_router = APIRouter(prefix="/gl", tags=["Finance - General Ledger"])


@gl_router.get("/summary", response_model=APIResponse[GlSummaryResponse])
def gl_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.gl:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[GlSummaryResponse]:
    summary = GeneralLedgerService(db).summary(ctx, company_id)
    return APIResponse(message="GL summary retrieved", data=summary)


@gl_router.get("/trial-balance-preview", response_model=APIResponse[GlTrialBalancePreviewResponse])
def trial_balance_preview(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.gl:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[GlTrialBalancePreviewResponse]:
    preview = GeneralLedgerService(db).trial_balance_preview(
        ctx,
        company_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        from_date=from_date,
        to_date=to_date,
    )
    return APIResponse(message="Trial balance preview retrieved", data=preview)


@gl_router.get("/accounts/{account_id}", response_model=APIResponse[GlAccountLedgerResponse])
def account_ledger(
    account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.gl:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> APIResponse[GlAccountLedgerResponse]:
    ledger = GeneralLedgerService(db).account_ledger(
        ctx,
        account_id,
        company_id,
        from_date=from_date,
        to_date=to_date,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
    )
    return APIResponse(message="Account ledger retrieved", data=ledger)


@gl_router.get("")
def list_gl_entries(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.gl:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    account_id: UUID | None = None,
    period_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    branch_id: UUID | None = None,
    cost_center_id: UUID | None = None,
    currency_code: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    from_date: date | None = None,
    to_date: date | None = None,
    sort_by: Annotated[str, Query()] = "entry_date",
    sort_dir: Annotated[str, Query()] = "asc",
    paged: Annotated[bool, Query()] = False,
    running_balance: Annotated[bool, Query()] = False,
) -> APIResponse[GlEntryListResponse | list[GlEntryResponse]]:
    """Default list stays an array for backward compatibility; use paged=true for enterprise UI."""
    entries = GeneralLedgerService(db).list_entries(
        ctx,
        company_id,
        account_id=account_id,
        period_id=period_id,
        fiscal_year_id=fiscal_year_id,
        branch_id=branch_id,
        cost_center_id=cost_center_id,
        currency_code=currency_code,
        journal_status=status,
        from_date=from_date,
        to_date=to_date,
        search=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        with_running_balance=running_balance or bool(account_id),
    )
    page = paginate(entries, pagination)
    total_debit = sum(e.base_debit_amount for e in entries)
    total_credit = sum(e.base_credit_amount for e in entries)
    if paged:
        return APIResponse(
            message="GL entries retrieved",
            data=GlEntryListResponse(
                items=page,
                total=len(entries),
                page=pagination.page,
                page_size=pagination.page_size,
                total_debit=total_debit,
                total_credit=total_credit,
            ),
        )
    return APIResponse(message="GL entries retrieved", data=page)


@gl_router.get("/{entry_id}", response_model=APIResponse[GlEntryResponse])
def get_gl_entry(
    entry_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.gl:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[GlEntryResponse]:
    entry = GeneralLedgerService(db).get_entry(ctx, entry_id)
    return APIResponse(message="GL entry retrieved", data=entry)
