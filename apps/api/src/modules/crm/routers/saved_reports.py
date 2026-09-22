"""CRM custom / saved report endpoints (mounted under /reports)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.schemas import (
    ReportRunRequest,
    ReportRunResponse,
    SavedReportCloneRequest,
    SavedReportCreate,
    SavedReportResponse,
    SavedReportUpdate,
)
from modules.crm.service.report_service import CRMReportService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

saved_reports_router = APIRouter(tags=["CRM - Reports"])


@saved_reports_router.get("/modules", response_model=APIResponse[list[dict]])
def list_report_modules(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CRMReportService(db).list_modules())


@saved_reports_router.get("/modules/{module_key}/columns", response_model=APIResponse[list[dict]])
def list_report_columns(
    module_key: str,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CRMReportService(db).list_columns(module_key))


@saved_reports_router.get("/saved", response_model=APIResponse[list[SavedReportResponse]])
def list_saved_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=CRMReportService(db).list_saved(ctx, company_id))


@saved_reports_router.post("/saved", response_model=APIResponse[SavedReportResponse])
def create_saved_report(
    body: SavedReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CRMReportService(db).create_saved(ctx, **body.model_dump())
    return APIResponse(message="OK", data=row)


@saved_reports_router.get("/saved/{report_id}", response_model=APIResponse[SavedReportResponse])
def get_saved_report(
    report_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CRMReportService(db).get_saved(ctx, report_id))


@saved_reports_router.patch("/saved/{report_id}", response_model=APIResponse[SavedReportResponse])
def update_saved_report(
    report_id: UUID,
    body: SavedReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CRMReportService(db).update_saved(ctx, report_id, **body.model_dump(exclude_unset=True))
    return APIResponse(message="OK", data=row)


@saved_reports_router.delete("/saved/{report_id}", response_model=APIResponse[dict[str, str]])
def delete_saved_report(
    report_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    CRMReportService(db).delete_saved(ctx, report_id)
    return APIResponse(message="OK", data={"id": str(report_id)})


@saved_reports_router.post("/saved/{report_id}/clone", response_model=APIResponse[SavedReportResponse])
def clone_saved_report(
    report_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    body: SavedReportCloneRequest = SavedReportCloneRequest(),
):
    row = CRMReportService(db).clone_saved(ctx, report_id, report_name=body.report_name)
    return APIResponse(message="OK", data=row)


@saved_reports_router.post("/run", response_model=APIResponse[ReportRunResponse])
def run_report(
    body: ReportRunRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CRMReportService(db).run(
        ctx,
        primary_module=body.primary_module,
        columns=body.columns,
        company_id=body.company_id,
        preview_limit=body.preview_limit,
    )
    return APIResponse(message="OK", data=data)


@saved_reports_router.get("/saved/{report_id}/run", response_model=APIResponse[ReportRunResponse])
def run_saved_report(
    report_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    preview_limit: int | None = Query(default=None),
):
    data = CRMReportService(db).run_saved(ctx, report_id, preview_limit=preview_limit)
    return APIResponse(message="OK", data=data)
