"""Non-IT asset API — types, locations, inventory, assign, Excel import."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.asset.dependencies import PaginationParams, get_db, get_pagination
from modules.asset.nonit.access import require_nonit_access, require_nonit_type_admin
from modules.asset.nonit.asset_service import NonItAssetService
from modules.asset.nonit.location_service import NonItLocationService
from modules.asset.nonit.schemas import (
    NonItAssetCreate,
    NonItAssetListResult,
    NonItAssetResponse,
    NonItAssetTypeCreate,
    NonItAssetTypeListResult,
    NonItAssetTypeResponse,
    NonItAssetTypeUpdate,
    NonItAssignRequest,
    NonItDashboardSummaryResponse,
    NonItDisposeRequest,
    NonItImportRequest,
    NonItImportSummary,
    NonItLocationCreate,
    NonItLocationListResult,
    NonItLocationResponse,
    NonItLocationUpdate,
    NonItMaintenanceCompleteRequest,
    NonItMaintenanceStartRequest,
    NonItNextCodePreviewResponse,
    NonItUnassignRequest,
)
from modules.asset.nonit.type_service import NonItAssetTypeService
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

nonit_router = APIRouter(prefix="/non-it", tags=["Asset — Non-IT"])


# --- Asset types ---


@nonit_router.get(
    "/asset-types",
    response_model=APIResponse[NonItAssetTypeListResult],
)
def list_nonit_asset_types(
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_type:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    active: bool | None = None,
    q: str | None = None,
    category: str | None = None,
):
    items = NonItAssetTypeService(db).list(
        ctx, company_id=company_id, active=active, search=q, category=category
    )
    payload = NonItAssetTypeListResult(
        items=[NonItAssetTypeResponse(**row) for row in items],
        total=len(items),
    )
    return APIResponse(message="OK", data=payload)


@nonit_router.get(
    "/asset-types/{row_id}/next-code-preview",
    response_model=APIResponse[NonItNextCodePreviewResponse],
)
def preview_nonit_next_code(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    """Provisional next code for Add Asset UI (not locked; may shift under concurrency)."""
    data = NonItAssetTypeService(db).peek_next_code(ctx, row_id, company_id=company_id)
    return APIResponse(message="OK", data=NonItNextCodePreviewResponse(**data))


@nonit_router.post(
    "/asset-types",
    response_model=APIResponse[NonItAssetTypeResponse],
    status_code=201,
)
def create_nonit_asset_type(
    body: NonItAssetTypeCreate,
    ctx: Annotated[TenantContext, Depends(require_nonit_type_admin("asset.nonit_type:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetTypeService(db).create(ctx, **body.model_dump(exclude_none=True))
    return APIResponse(message="Created", data=NonItAssetTypeResponse(**row))


@nonit_router.patch(
    "/asset-types/{row_id}",
    response_model=APIResponse[NonItAssetTypeResponse],
)
def update_nonit_asset_type(
    row_id: UUID,
    body: NonItAssetTypeUpdate,
    ctx: Annotated[TenantContext, Depends(require_nonit_type_admin("asset.nonit_type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetTypeService(db).update(
        ctx, row_id, **body.model_dump(exclude_unset=True)
    )
    return APIResponse(message="Updated", data=NonItAssetTypeResponse(**row))


# --- Locations ---


@nonit_router.get(
    "/locations",
    response_model=APIResponse[NonItLocationListResult],
)
def list_nonit_locations(
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    active: bool | None = None,
    q: str | None = None,
    location_kind: str | None = None,
):
    items = NonItLocationService(db).list(
        ctx,
        company_id=company_id,
        active=active,
        search=q,
        location_kind=location_kind,
    )
    payload = NonItLocationListResult(
        items=[NonItLocationResponse(**row) for row in items],
        total=len(items),
    )
    return APIResponse(message="OK", data=payload)


@nonit_router.post(
    "/locations",
    response_model=APIResponse[NonItLocationResponse],
    status_code=201,
)
def create_nonit_location(
    body: NonItLocationCreate,
    ctx: Annotated[TenantContext, Depends(require_nonit_type_admin("asset.nonit_type:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItLocationService(db).create(ctx, **body.model_dump(exclude_none=True))
    return APIResponse(message="Created", data=NonItLocationResponse(**row))


@nonit_router.patch(
    "/locations/{row_id}",
    response_model=APIResponse[NonItLocationResponse],
)
def update_nonit_location(
    row_id: UUID,
    body: NonItLocationUpdate,
    ctx: Annotated[TenantContext, Depends(require_nonit_type_admin("asset.nonit_type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItLocationService(db).update(
        ctx, row_id, **body.model_dump(exclude_unset=True)
    )
    return APIResponse(message="Updated", data=NonItLocationResponse(**row))


# --- Assets ---


@nonit_router.get(
    "/assets",
    response_model=APIResponse[NonItAssetListResult],
)
def list_nonit_assets(
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_type_id: UUID | None = None,
    location_id: UUID | None = None,
    status: str | None = None,
    assignment: Annotated[
        str | None, Query(description="assigned | unassigned")
    ] = None,
    q: str | None = None,
):
    items, total = NonItAssetService(db).list(
        ctx,
        company_id=company_id,
        asset_type_id=asset_type_id,
        location_id=location_id,
        status=status,
        assignment=assignment,
        q=q,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    payload = NonItAssetListResult(
        items=[NonItAssetResponse(**row) for row in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)


@nonit_router.get(
    "/dashboard-summary",
    response_model=APIResponse[NonItDashboardSummaryResponse],
)
def nonit_dashboard_summary(
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    summary = NonItAssetService(db).dashboard_summary(ctx, company_id=company_id)
    return APIResponse(
        message="OK", data=NonItDashboardSummaryResponse(**summary)
    )


@nonit_router.post(
    "/assets",
    response_model=APIResponse[NonItAssetResponse],
    status_code=201,
)
def create_nonit_asset(
    body: NonItAssetCreate,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).create(ctx, **body.model_dump(exclude_none=True))
    return APIResponse(message="Created", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/import",
    response_model=APIResponse[NonItImportSummary],
)
def import_nonit_assets(
    body: NonItImportRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    summary = NonItAssetService(db).import_rows(
        ctx,
        [r.model_dump() for r in body.rows],
        company_id=body.company_id,
        branch_id=body.branch_id,
    )
    return APIResponse(message="Imported", data=NonItImportSummary(**summary))


@nonit_router.get(
    "/assets/{row_id}",
    response_model=APIResponse[NonItAssetResponse],
)
def get_nonit_asset(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    include_timeline: Annotated[bool, Query()] = True,
):
    row = NonItAssetService(db).get(ctx, row_id, include_timeline=include_timeline)
    return APIResponse(message="OK", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/{row_id}/assign",
    response_model=APIResponse[NonItAssetResponse],
)
def assign_nonit_asset(
    row_id: UUID,
    body: NonItAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).assign(
        ctx,
        row_id,
        employee_id=body.employee_id,
        location_id=body.location_id,
        version=body.version,
        remarks=body.remarks,
    )
    return APIResponse(message="Assigned", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/{row_id}/unassign",
    response_model=APIResponse[NonItAssetResponse],
)
def unassign_nonit_asset(
    row_id: UUID,
    body: NonItUnassignRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).unassign(
        ctx, row_id, version=body.version, remarks=body.remarks
    )
    return APIResponse(message="Unassigned", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/{row_id}/maintenance/start",
    response_model=APIResponse[NonItAssetResponse],
)
def start_nonit_maintenance(
    row_id: UUID,
    body: NonItMaintenanceStartRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).start_maintenance(
        ctx,
        row_id,
        maintenance_reason=body.maintenance_reason,
        maintenance_notes=body.maintenance_notes,
        maintenance_provider=body.maintenance_provider,
        maintenance_cost=body.maintenance_cost,
        version=body.version,
    )
    return APIResponse(message="Maintenance started", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/{row_id}/maintenance/complete",
    response_model=APIResponse[NonItAssetResponse],
)
def complete_nonit_maintenance(
    row_id: UUID,
    body: NonItMaintenanceCompleteRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).complete_maintenance(
        ctx,
        row_id,
        completion_notes=body.completion_notes,
        completion_date=body.completion_date,
        restore_prior_holder=body.restore_prior_holder,
        version=body.version,
    )
    return APIResponse(message="Maintenance completed", data=NonItAssetResponse(**row))


@nonit_router.post(
    "/assets/{row_id}/dispose",
    response_model=APIResponse[NonItAssetResponse],
)
def dispose_nonit_asset(
    row_id: UUID,
    body: NonItDisposeRequest,
    ctx: Annotated[TenantContext, Depends(require_nonit_access("asset.nonit_asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NonItAssetService(db).dispose(
        ctx,
        row_id,
        disposal_reason=body.disposal_reason,
        disposal_date=body.disposal_date,
        remarks=body.remarks,
        version=body.version,
    )
    return APIResponse(message="Disposed", data=NonItAssetResponse(**row))
