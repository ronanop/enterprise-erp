"""Fiscal year and period routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.finance.dependencies import PaginationParams, extract_update_fields, get_pagination, paginate
from modules.finance.schemas import (
    BulkPeriodActionRequest,
    BulkPeriodActionResult,
    FiscalSummaryResponse,
    FiscalYearClosePreviewResponse,
    FiscalYearCreateRequest,
    FiscalYearImportRequest,
    FiscalYearImportResult,
    FiscalYearListResponse,
    FiscalYearResponse,
    FiscalYearUpdateRequest,
    PeriodCloseFlagsRequest,
    PeriodListResponse,
    PeriodResponse,
    WorkflowActionRequest,
)
from modules.finance.service.fiscal_year_service import FiscalYearService
from modules.finance.service.period_service import PeriodService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

fiscal_years_router = APIRouter(prefix="/fiscal-years", tags=["Finance - Fiscal Years"])
periods_router = APIRouter(prefix="/periods", tags=["Finance - Periods"])


@fiscal_years_router.get("/summary", response_model=APIResponse[FiscalSummaryResponse])
def fiscal_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[FiscalSummaryResponse]:
    summary = FiscalYearService(db).summary(ctx, company_id)
    return APIResponse(message="Fiscal summary retrieved", data=summary)


@fiscal_years_router.get("")
def list_fiscal_years(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "start_date",
    sort_dir: Annotated[str, Query()] = "desc",
    paged: Annotated[bool, Query()] = False,
) -> APIResponse[FiscalYearListResponse | list[FiscalYearResponse]]:
    years = FiscalYearService(db).list_fiscal_years(
        ctx, company_id, status=status, search=q, sort_by=sort_by, sort_dir=sort_dir
    )
    page = paginate(years, pagination)
    if paged:
        return APIResponse(
            message="Fiscal years retrieved",
            data=FiscalYearListResponse(
                items=page,
                total=len(years),
                page=pagination.page,
                page_size=pagination.page_size,
            ),
        )
    return APIResponse(message="Fiscal years retrieved", data=page)


@fiscal_years_router.post("", response_model=APIResponse[FiscalYearResponse])
def create_fiscal_year(
    body: FiscalYearCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).create_fiscal_year(ctx, company_id=company_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Fiscal year created", data=fy)


@fiscal_years_router.post("/import", response_model=APIResponse[FiscalYearImportResult])
def import_fiscal_years(
    body: FiscalYearImportRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[FiscalYearImportResult]:
    result = FiscalYearService(db).import_fiscal_years(ctx, company_id, body.rows)
    db.commit()
    return APIResponse(message="Import completed", data=result)


@fiscal_years_router.get("/{fiscal_year_id}", response_model=APIResponse[FiscalYearResponse])
def get_fiscal_year(
    fiscal_year_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).get_fiscal_year(ctx, fiscal_year_id)
    return APIResponse(message="Fiscal year retrieved", data=fy)


@fiscal_years_router.patch("/{fiscal_year_id}", response_model=APIResponse[FiscalYearResponse])
def update_fiscal_year(
    fiscal_year_id: UUID,
    body: FiscalYearUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).update_fiscal_year(
        ctx, fiscal_year_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Fiscal year updated", data=fy)


@fiscal_years_router.delete("/{fiscal_year_id}", response_model=APIResponse[dict])
def delete_fiscal_year(
    fiscal_year_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    FiscalYearService(db).delete_fiscal_year(ctx, fiscal_year_id)
    db.commit()
    return APIResponse(message="Fiscal year deleted", data={})


@fiscal_years_router.get(
    "/{fiscal_year_id}/close-preview",
    response_model=APIResponse[FiscalYearClosePreviewResponse],
)
def close_preview(
    fiscal_year_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearClosePreviewResponse]:
    preview = FiscalYearService(db).close_preview(ctx, fiscal_year_id)
    return APIResponse(message="Close preview generated", data=preview)


@fiscal_years_router.post("/{fiscal_year_id}/close", response_model=APIResponse[FiscalYearResponse])
def close_fiscal_year(
    fiscal_year_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).close_fiscal_year(ctx, fiscal_year_id)
    db.commit()
    return APIResponse(message="Fiscal year closed", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/archive", response_model=APIResponse[FiscalYearResponse])
def archive_fiscal_year(
    fiscal_year_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).archive_fiscal_year(ctx, fiscal_year_id)
    db.commit()
    return APIResponse(message="Fiscal year archived", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/activate", response_model=APIResponse[FiscalYearResponse])
def activate_fiscal_year(
    fiscal_year_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).activate_fiscal_year(ctx, fiscal_year_id)
    db.commit()
    return APIResponse(message="Fiscal year activated", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/deactivate", response_model=APIResponse[FiscalYearResponse])
def deactivate_fiscal_year(
    fiscal_year_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).deactivate_fiscal_year(ctx, fiscal_year_id)
    db.commit()
    return APIResponse(message="Fiscal year deactivated", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/submit", response_model=APIResponse[FiscalYearResponse])
def submit_fiscal_year(
    fiscal_year_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).submit_fiscal_year(ctx, fiscal_year_id, body.comments)
    db.commit()
    return APIResponse(message="Fiscal year submitted", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/approve", response_model=APIResponse[FiscalYearResponse])
def approve_fiscal_year(
    fiscal_year_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).approve_fiscal_year(ctx, fiscal_year_id, body.comments)
    db.commit()
    return APIResponse(message="Fiscal year approved", data=fy)


@fiscal_years_router.post("/{fiscal_year_id}/reject", response_model=APIResponse[FiscalYearResponse])
def reject_fiscal_year(
    fiscal_year_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.fiscal_year:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[FiscalYearResponse]:
    fy = FiscalYearService(db).reject_fiscal_year(ctx, fiscal_year_id, body.comments)
    db.commit()
    return APIResponse(message="Fiscal year rejected", data=fy)


@periods_router.get("")
def list_periods(
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    fiscal_year_id: UUID | None = None,
    status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "period_number",
    sort_dir: Annotated[str, Query()] = "asc",
    paged: Annotated[bool, Query()] = False,
) -> APIResponse[PeriodListResponse | list[PeriodResponse]]:
    periods = PeriodService(db).list_periods(
        ctx,
        company_id,
        fiscal_year_id,
        status=status,
        search=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    page = paginate(periods, pagination)
    if paged:
        return APIResponse(
            message="Periods retrieved",
            data=PeriodListResponse(
                items=page,
                total=len(periods),
                page=pagination.page,
                page_size=pagination.page_size,
            ),
        )
    return APIResponse(message="Periods retrieved", data=page)


@periods_router.post("/bulk", response_model=APIResponse[BulkPeriodActionResult])
def bulk_period_action(
    body: BulkPeriodActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[BulkPeriodActionResult]:
    result = PeriodService(db).bulk_action(ctx, body.period_ids, body.action, body.comments)
    db.commit()
    return APIResponse(message="Bulk action completed", data=result)


@periods_router.get("/{period_id}", response_model=APIResponse[PeriodResponse])
def get_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).get_period(ctx, period_id)
    return APIResponse(message="Period retrieved", data=period)


@periods_router.post("/{period_id}/soft-close", response_model=APIResponse[PeriodResponse])
def soft_close_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).soft_close(ctx, period_id)
    db.commit()
    return APIResponse(message="Period soft closed", data=period)


@periods_router.post("/{period_id}/hard-close", response_model=APIResponse[PeriodResponse])
def hard_close_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).hard_close(ctx, period_id)
    db.commit()
    return APIResponse(message="Period hard closed", data=period)


@periods_router.post("/{period_id}/close", response_model=APIResponse[PeriodResponse])
def close_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).close_period(ctx, period_id)
    db.commit()
    return APIResponse(message="Period closed", data=period)


@periods_router.post("/{period_id}/open", response_model=APIResponse[PeriodResponse])
def open_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:reopen"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).open_period(ctx, period_id)
    db.commit()
    return APIResponse(message="Period opened", data=period)


@periods_router.post("/{period_id}/lock", response_model=APIResponse[PeriodResponse])
def lock_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).lock_period(ctx, period_id)
    db.commit()
    return APIResponse(message="Period locked", data=period)


@periods_router.post("/{period_id}/unlock", response_model=APIResponse[PeriodResponse])
def unlock_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:reopen"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).unlock_period(ctx, period_id)
    db.commit()
    return APIResponse(message="Period unlocked", data=period)


@periods_router.post("/{period_id}/reopen", response_model=APIResponse[PeriodResponse])
def reopen_period(
    period_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:reopen"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).reopen(ctx, period_id)
    db.commit()
    return APIResponse(message="Period reopened", data=period)


@periods_router.patch("/{period_id}/flags", response_model=APIResponse[PeriodResponse])
def update_period_flags(
    period_id: UUID,
    body: PeriodCloseFlagsRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("finance.period:close"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeriodResponse]:
    period = PeriodService(db).update_close_flags(
        ctx, period_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Period flags updated", data=period)
