"""Asset API route handlers."""

from typing import Annotated
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.asset.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.asset.schemas import (
    AssetAssignmentCreate,
    AssetAssignmentListResult,
    AssetAssignmentResponse,
    AssetAssignmentUpdate,
    AssetAuditCreate,
    AssetAuditListResult,
    AssetAuditResponse,
    AssetAuditUpdate,
    AssetCategoryCreate,
    AssetCategoryListResult,
    AssetCategoryResponse,
    AssetCategoryUpdate,
    AssetChecklistCreate,
    AssetChecklistListResult,
    AssetChecklistResponse,
    AssetChecklistUpdate,
    AssetComponentCreate,
    AssetComponentHistoryResult,
    AssetComponentListResult,
    AssetComponentReplace,
    AssetComponentReplaceResult,
    AssetComponentResponse,
    AssetComponentTreeResult,
    AssetComponentUpdate,
    AssetCreate,
    AssetDepreciationCreate,
    AssetDepreciationListResult,
    AssetDepreciationResponse,
    AssetDepreciationUpdate,
    DepreciationCalculateRequest,
    DepreciationGenerateRunRequest,
    DepreciationGenerateRunResult,
    AssetDisposalCreate,
    AssetDisposalListResult,
    AssetDisposalResponse,
    AssetDisposalUpdate,
    AssetDocumentCreate,
    AssetDocumentListResult,
    AssetDocumentResponse,
    AssetDocumentUpdate,
    AssetInformationPortalResponse,
    DiscoveryApplyRequest,
    DiscoveryApplyResult,
    DiscoveryCommandResponse,
    DiscoveryParseRequest,
    DiscoveryParseResult,
    GrnPrefillResponse,
    AssetInsuranceCreate,
    AssetInsuranceListResult,
    AssetInsuranceRenew,
    AssetInsuranceResponse,
    AssetInsuranceUpdate,
    AssetListResult,
    AssetLocationCreate,
    AssetLocationListResult,
    AssetLocationResponse,
    AssetLocationUpdate,
    AssetMaintenanceCreate,
    AssetMaintenanceListResult,
    AssetMaintenanceResponse,
    AssetMaintenanceUpdate,
    AssetNotificationCreate,
    AssetNotificationListResult,
    AssetNotificationResponse,
    AssetNotificationUpdate,
    AssetReportCreate,
    AssetReportCatalogItem,
    AssetReportDashboardResponse,
    AssetReportExportResult,
    AssetReportGenerate,
    AssetReportListResult,
    AssetReportResponse,
    AssetReportRunResult,
    AssetReportUpdate,
    AssetResponse,
    AssetRevaluationCreate,
    AssetRevaluationListResult,
    AssetRevaluationResponse,
    AssetRevaluationUpdate,
    AssetTransferCreate,
    AssetTransferListResult,
    AssetTransferResponse,
    AssetTransferUpdate,
    AssetUpdate,
    AssetWarrantyCreate,
    AssetWarrantyExtend,
    AssetWarrantyListResult,
    AssetWarrantyResponse,
    AssetWarrantyUpdate,
    FinancePostRequest,
    MaintenancePlanCreate,
    MaintenancePlanListResult,
    MaintenancePlanResponse,
    MaintenancePlanUpdate,
    MaintenanceScheduleRequest,
    MeterReadingCreate,
    MeterReadingListResult,
    MeterReadingResponse,
    ServiceHistoryCreate,
    ServiceHistoryListResult,
    ServiceHistoryResponse,
    WorkflowActionRequest,
)
from modules.asset.service import (
    AssetAuditService,
    AssetCategoryService,
    AssetReportService,
    AssetService,
    AssignmentService,
    ChecklistService,
    AssetComponentService,
    DepreciationService,
    DisposalService,
    DocumentService,
    InsuranceService,
    LocationService,
    MaintenancePlanService,
    MaintenanceService,
    MeterReadingService,
    AssetNotificationService,
    RevaluationService,
    ServiceHistoryService,
    TransferService,
    WarrantyService,
)
from modules.asset.service.information_portal_service import AssetInformationPortalService
from modules.asset.service.discovery_service import AssetDiscoveryService
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

asset_categories_router = APIRouter(prefix="/asset-categories", tags=["Asset — AssetCategory"])

@asset_categories_router.get("", response_model=APIResponse[AssetCategoryListResult])
def list_asset_categories(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
):
    items = AssetCategoryService(db).list(
        ctx, company_id=company_id, status=status, search=q
    )
    total = len(items)
    page_items = paginate(items, pagination)
    payload = AssetCategoryListResult(
        items=page_items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_categories_router.get("/{row_id}", response_model=APIResponse[AssetCategoryResponse])
def get_asset_categories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetCategoryService(db).get(ctx, row_id))

@asset_categories_router.post("", response_model=APIResponse[AssetCategoryResponse])
def create_asset_categories(
    body: AssetCategoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AssetCategoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@asset_categories_router.patch("/{row_id}", response_model=APIResponse[AssetCategoryResponse])
def update_asset_categories(
    row_id: UUID,
    body: AssetCategoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssetCategoryService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )


@asset_categories_router.post(
    "/{row_id}/deactivate",
    response_model=APIResponse[AssetCategoryResponse],
)
def deactivate_asset_category(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Deactivated",
        data=AssetCategoryService(db).deactivate(ctx, row_id),
    )


@asset_categories_router.post(
    "/{row_id}/reactivate",
    response_model=APIResponse[AssetCategoryResponse],
)
def reactivate_asset_category(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Reactivated",
        data=AssetCategoryService(db).reactivate(ctx, row_id),
    )

assets_router = APIRouter(prefix="/assets", tags=["Asset — Asset"])

@assets_router.get("", response_model=APIResponse[AssetListResult])
def list_assets(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    asset_category_id: UUID | None = None,
    q: str | None = None,
):
    items, total = AssetService(db).search(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        status=status,
        asset_category_id=asset_category_id,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetListResult(
        items=[AssetResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@assets_router.get("/registration/prefill", response_model=APIResponse[GrnPrefillResponse])
def prefill_asset_registration_from_grn(
    grn_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    prefill = AssetService(db).prefill_from_grn(ctx, grn_id)
    return APIResponse(
        message="OK",
        data=GrnPrefillResponse(
            grn_id=prefill.grn_id,
            company_id=prefill.company_id,
            branch_id=prefill.branch_id,
            vendor_id=prefill.vendor_id,
            purchase_order_id=prefill.purchase_order_id,
            currency_code=prefill.currency_code,
            lines=prefill.lines,
        ),
    )

@assets_router.get("/{row_id}", response_model=APIResponse[AssetResponse])
def get_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetService(db).get(ctx, row_id))


@assets_router.get(
    "/{row_id}/information-portal",
    response_model=APIResponse[AssetInformationPortalResponse],
)
def get_asset_information_portal(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=AssetInformationPortalService(db).get_portal(ctx, row_id),
    )


@assets_router.get(
    "/{row_id}/self-service",
    response_model=APIResponse[AssetInformationPortalResponse],
)
def get_asset_self_service(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Authenticated self-service profile (same redaction as information portal)."""
    return APIResponse(
        message="OK",
        data=AssetInformationPortalService(db).get_self_service(ctx, row_id),
    )


@assets_router.get(
    "/discovery/command",
    response_model=APIResponse[DiscoveryCommandResponse],
)
def get_discovery_command(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    platform: str = "windows",
):
    payload = AssetDiscoveryService(db).get_command(platform)
    return APIResponse(message="OK", data=DiscoveryCommandResponse(**payload))


@assets_router.post(
    "/{row_id}/discovery/parse",
    response_model=APIResponse[DiscoveryParseResult],
)
def parse_asset_discovery(
    row_id: UUID,
    body: DiscoveryParseRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Parsed",
        data=AssetDiscoveryService(db).parse(
            ctx,
            row_id,
            platform=body.platform,
            raw_output=body.raw_output,
        ),
    )


@assets_router.post(
    "/{row_id}/discovery/apply",
    response_model=APIResponse[DiscoveryApplyResult],
)
def apply_asset_discovery(
    row_id: UUID,
    body: DiscoveryApplyRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Applied",
        data=AssetDiscoveryService(db).apply(
            ctx,
            row_id,
            platform=body.platform,
            raw_output=body.raw_output,
            version=body.version,
            preview_confirmed=body.preview_confirmed,
        ),
    )

@assets_router.post("", response_model=APIResponse[AssetResponse])
def create_assets(
    body: AssetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    branch_id = payload.pop("branch_id")
    return APIResponse(
        message="Created",
        data=AssetService(db).create(ctx, branch_id=branch_id, **payload),
    )

@assets_router.patch("/{row_id}", response_model=APIResponse[AssetResponse])
def update_assets(
    row_id: UUID,
    body: AssetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AssetService(db).update(ctx, row_id, **extract_update_fields(body)))

@assets_router.post("/{row_id}/submit", response_model=APIResponse[AssetResponse])
def submit_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=AssetService(db).submit(ctx, row_id))

@assets_router.post("/{row_id}/approve", response_model=APIResponse[AssetResponse])
def approve_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="approve", data=AssetService(db).approve(ctx, row_id, comments=comments))

@assets_router.post("/{row_id}/reject", response_model=APIResponse[AssetResponse])
def reject_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="reject", data=AssetService(db).reject(ctx, row_id, comments=comments))

@assets_router.post("/{row_id}/cancel", response_model=APIResponse[AssetResponse])
def cancel_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=AssetService(db).cancel_draft(ctx, row_id))

@assets_router.post("/{row_id}/reopen", response_model=APIResponse[AssetResponse])
def reopen_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=AssetService(db).reopen(ctx, row_id))

@assets_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetResponse])
def resubmit_assets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=AssetService(db).resubmit(ctx, row_id))

asset_components_router = APIRouter(prefix="/asset-components", tags=["Asset — AssetComponent"])

@asset_components_router.get("", response_model=APIResponse[AssetComponentListResult])
def list_asset_components(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    status: str | None = None,
    product_id: UUID | None = None,
    branch_id: UUID | None = None,
    q: str | None = None,
    sort: str = "created_at",
):
    items, total = AssetComponentService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        status=status,
        product_id=product_id,
        branch_id=branch_id,
        search=q,
        sort=sort,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetComponentListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_components_router.get("/tree", response_model=APIResponse[AssetComponentTreeResult])
def tree_asset_components(
    asset_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=AssetComponentService(db).tree(ctx, asset_id, company_id=company_id),
    )

@asset_components_router.get("/{row_id}", response_model=APIResponse[AssetComponentResponse])
def get_asset_components(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetComponentService(db).get(ctx, row_id))

@asset_components_router.get(
    "/{row_id}/history", response_model=APIResponse[AssetComponentHistoryResult]
)
def history_asset_components(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetComponentService(db).history(ctx, row_id))

@asset_components_router.post("", response_model=APIResponse[AssetComponentResponse])
def create_asset_components(
    body: AssetComponentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=AssetComponentService(db).install(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_components_router.patch("/{row_id}", response_model=APIResponse[AssetComponentResponse])
def update_asset_components(
    row_id: UUID,
    body: AssetComponentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssetComponentService(db).update(
            ctx, row_id, **body.model_dump(exclude_unset=True)
        ),
    )

@asset_components_router.post(
    "/{row_id}/replace", response_model=APIResponse[AssetComponentReplaceResult]
)
def replace_asset_components(
    row_id: UUID,
    body: AssetComponentReplace,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    result = AssetComponentService(db).replace(
        ctx, row_id, **body.model_dump(exclude_none=True)
    )
    return APIResponse(message="replace", data=result)

@asset_components_router.post(
    "/{row_id}/dispose", response_model=APIResponse[AssetComponentResponse]
)
def dispose_asset_components(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="dispose", data=AssetComponentService(db).dispose(ctx, row_id)
    )

asset_assignments_router = APIRouter(prefix="/asset-assignments", tags=["Asset — AssetAssignment"])

@asset_assignments_router.get("", response_model=APIResponse[AssetAssignmentListResult])
def list_asset_assignments(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    allocation_type: str | None = None,
    q: str | None = None,
):
    items, total = AssignmentService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        branch_id=branch_id,
        status=status,
        allocation_type=allocation_type,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetAssignmentListResult(
        items=[AssetAssignmentResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_assignments_router.get("/{row_id}", response_model=APIResponse[AssetAssignmentResponse])
def get_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssignmentService(db).get(ctx, row_id))

@asset_assignments_router.post("", response_model=APIResponse[AssetAssignmentResponse])
def create_asset_assignments(
    body: AssetAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=AssignmentService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_assignments_router.patch("/{row_id}", response_model=APIResponse[AssetAssignmentResponse])
def update_asset_assignments(
    row_id: UUID,
    body: AssetAssignmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssignmentService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_assignments_router.post("/{row_id}/submit", response_model=APIResponse[AssetAssignmentResponse])
def submit_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=AssignmentService(db).submit(ctx, row_id))

@asset_assignments_router.post("/{row_id}/approve", response_model=APIResponse[AssetAssignmentResponse])
def approve_asset_assignments(
    row_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="approve",
        data=AssignmentService(db).approve(ctx, row_id, comments=body.comments),
    )

@asset_assignments_router.post("/{row_id}/reject", response_model=APIResponse[AssetAssignmentResponse])
def reject_asset_assignments(
    row_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="reject",
        data=AssignmentService(db).reject(ctx, row_id, comments=body.comments),
    )


@asset_assignments_router.post("/{row_id}/cancel", response_model=APIResponse[AssetAssignmentResponse])
def cancel_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=AssignmentService(db).cancel_draft(ctx, row_id))


@asset_assignments_router.post("/{row_id}/reopen", response_model=APIResponse[AssetAssignmentResponse])
def reopen_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=AssignmentService(db).reopen(ctx, row_id))


@asset_assignments_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetAssignmentResponse])
def resubmit_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=AssignmentService(db).resubmit(ctx, row_id))


@asset_assignments_router.post("/{row_id}/return", response_model=APIResponse[AssetAssignmentResponse])
def return_asset_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.assignment:return"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="return", data=AssignmentService(db).return_assignment(ctx, row_id))

asset_transfers_router = APIRouter(prefix="/asset-transfers", tags=["Asset — AssetTransfer"])

@asset_transfers_router.get("", response_model=APIResponse[AssetTransferListResult])
def list_asset_transfers(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
    effective_from: date | None = None,
    effective_to: date | None = None,
):
    items, total = TransferService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        branch_id=branch_id,
        status=status,
        search=q,
        effective_from=effective_from,
        effective_to=effective_to,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetTransferListResult(
        items=[AssetTransferResponse.model_validate(i) for i in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_transfers_router.get("/{row_id}", response_model=APIResponse[AssetTransferResponse])
def get_asset_transfers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TransferService(db).get(ctx, row_id))

@asset_transfers_router.post("", response_model=APIResponse[AssetTransferResponse])
def create_asset_transfers(
    body: AssetTransferCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TransferService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_transfers_router.patch("/{row_id}", response_model=APIResponse[AssetTransferResponse])
def update_asset_transfers(
    row_id: UUID,
    body: AssetTransferUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TransferService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_transfers_router.post("/{row_id}/submit", response_model=APIResponse[AssetTransferResponse])
def submit_asset_transfers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=TransferService(db).submit(ctx, row_id))


@asset_transfers_router.post("/{row_id}/approve", response_model=APIResponse[AssetTransferResponse])
def approve_asset_transfers(
    row_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="approve",
        data=TransferService(db).approve(ctx, row_id, comments=body.comments),
    )


@asset_transfers_router.post("/{row_id}/reject", response_model=APIResponse[AssetTransferResponse])
def reject_asset_transfers(
    row_id: UUID,
    body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="reject",
        data=TransferService(db).reject(ctx, row_id, comments=body.comments),
    )


@asset_transfers_router.post("/{row_id}/cancel", response_model=APIResponse[AssetTransferResponse])
def cancel_asset_transfers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=TransferService(db).cancel_draft(ctx, row_id))


@asset_transfers_router.post("/{row_id}/reopen", response_model=APIResponse[AssetTransferResponse])
def reopen_asset_transfers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=TransferService(db).reopen(ctx, row_id))


@asset_transfers_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetTransferResponse])
def resubmit_asset_transfers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.transfer:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=TransferService(db).resubmit(ctx, row_id))

asset_locations_router = APIRouter(prefix="/asset-locations", tags=["Asset — AssetLocation"])

@asset_locations_router.get("", response_model=APIResponse[AssetLocationListResult])
def list_asset_locations(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.location:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    status: str | None = None,
    is_current: bool | None = None,
    branch_id: UUID | None = None,
    q: str | None = None,
):
    items, total = LocationService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        status=status,
        is_current=is_current,
        branch_id=branch_id,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetLocationListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_locations_router.get("/{row_id}", response_model=APIResponse[AssetLocationResponse])
def get_asset_locations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.location:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LocationService(db).get(ctx, row_id))

@asset_locations_router.post("", response_model=APIResponse[AssetLocationResponse])
def create_asset_locations(
    body: AssetLocationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.location:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=LocationService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_locations_router.patch("/{row_id}", response_model=APIResponse[AssetLocationResponse])
def update_asset_locations(
    row_id: UUID,
    body: AssetLocationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.location:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=LocationService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_locations_router.post("/{row_id}/complete", response_model=APIResponse[AssetLocationResponse])
def complete_asset_locations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.location:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=LocationService(db).complete(ctx, row_id))

asset_warranties_router = APIRouter(prefix="/asset-warranties", tags=["Asset — AssetWarranty"])

@asset_warranties_router.get("", response_model=APIResponse[AssetWarrantyListResult])
def list_asset_warranties(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    vendor_id: UUID | None = None,
    warranty_type: str | None = None,
    status: str | None = None,
    expiry_date: date | None = None,
    q: str | None = None,
):
    items, total = WarrantyService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        vendor_id=vendor_id,
        warranty_type=warranty_type,
        status=status,
        end_date=expiry_date,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetWarrantyListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_warranties_router.get("/{row_id}", response_model=APIResponse[AssetWarrantyResponse])
def get_asset_warranties(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=WarrantyService(db).get(ctx, row_id))

@asset_warranties_router.post("", response_model=APIResponse[AssetWarrantyResponse])
def create_asset_warranties(
    body: AssetWarrantyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=WarrantyService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_warranties_router.patch("/{row_id}", response_model=APIResponse[AssetWarrantyResponse])
def update_asset_warranties(
    row_id: UUID,
    body: AssetWarrantyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=WarrantyService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_warranties_router.post("/{row_id}/activate", response_model=APIResponse[AssetWarrantyResponse])
def activate_asset_warranties(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:activate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="activate", data=WarrantyService(db).activate(ctx, row_id))

@asset_warranties_router.post("/{row_id}/extend", response_model=APIResponse[AssetWarrantyResponse])
def extend_asset_warranties(
    row_id: UUID,
    body: AssetWarrantyExtend,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:extend"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="extend",
        data=WarrantyService(db).extend(ctx, row_id, new_end_date=body.new_end_date),
    )

@asset_warranties_router.post("/{row_id}/expire", response_model=APIResponse[AssetWarrantyResponse])
def expire_asset_warranties(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.warranty:expire"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="expire", data=WarrantyService(db).expire(ctx, row_id))

asset_insurances_router = APIRouter(prefix="/asset-insurances", tags=["Asset — AssetInsurance"])

@asset_insurances_router.get("", response_model=APIResponse[AssetInsuranceListResult])
def list_asset_insurances(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    vendor_id: UUID | None = None,
    status: str | None = None,
    expiry_date: date | None = None,
    q: str | None = None,
):
    items, total = InsuranceService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        vendor_id=vendor_id,
        status=status,
        end_date=expiry_date,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetInsuranceListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_insurances_router.get("/{row_id}", response_model=APIResponse[AssetInsuranceResponse])
def get_asset_insurances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=InsuranceService(db).get(ctx, row_id))

@asset_insurances_router.post("", response_model=APIResponse[AssetInsuranceResponse])
def create_asset_insurances(
    body: AssetInsuranceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=InsuranceService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_insurances_router.patch("/{row_id}", response_model=APIResponse[AssetInsuranceResponse])
def update_asset_insurances(
    row_id: UUID,
    body: AssetInsuranceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=InsuranceService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_insurances_router.post("/{row_id}/activate", response_model=APIResponse[AssetInsuranceResponse])
def activate_asset_insurances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:activate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="activate", data=InsuranceService(db).activate(ctx, row_id))

@asset_insurances_router.post("/{row_id}/renew", response_model=APIResponse[AssetInsuranceResponse])
def renew_asset_insurances(
    row_id: UUID,
    body: AssetInsuranceRenew,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:renew"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="renew",
        data=InsuranceService(db).renew(ctx, row_id, new_end_date=body.new_end_date),
    )

@asset_insurances_router.post("/{row_id}/expire", response_model=APIResponse[AssetInsuranceResponse])
def expire_asset_insurances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:expire"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="expire", data=InsuranceService(db).expire(ctx, row_id))

@asset_insurances_router.post("/{row_id}/close", response_model=APIResponse[AssetInsuranceResponse])
def close_asset_insurances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.insurance:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="close", data=InsuranceService(db).close(ctx, row_id))

maintenance_plans_router = APIRouter(prefix="/maintenance-plans", tags=["Asset — MaintenancePlan"])

@maintenance_plans_router.get("", response_model=APIResponse[MaintenancePlanListResult])
def list_maintenance_plans(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    maintenance_type: str | None = None,
    status: str | None = None,
    next_due_date: date | None = None,
    branch_id: UUID | None = None,
    q: str | None = None,
):
    items, total = MaintenancePlanService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        maintenance_type=maintenance_type,
        status=status,
        next_due_date=next_due_date,
        branch_id=branch_id,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = MaintenancePlanListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@maintenance_plans_router.get("/{row_id}", response_model=APIResponse[MaintenancePlanResponse])
def get_maintenance_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MaintenancePlanService(db).get(ctx, row_id))

@maintenance_plans_router.post("", response_model=APIResponse[MaintenancePlanResponse])
def create_maintenance_plans(
    body: MaintenancePlanCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=MaintenancePlanService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@maintenance_plans_router.patch("/{row_id}", response_model=APIResponse[MaintenancePlanResponse])
def update_maintenance_plans(
    row_id: UUID,
    body: MaintenancePlanUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=MaintenancePlanService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@maintenance_plans_router.post("/{row_id}/activate", response_model=APIResponse[MaintenancePlanResponse])
def activate_maintenance_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:activate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="activate", data=MaintenancePlanService(db).activate(ctx, row_id))

@maintenance_plans_router.post("/{row_id}/pause", response_model=APIResponse[MaintenancePlanResponse])
def pause_maintenance_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:pause"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="pause", data=MaintenancePlanService(db).pause(ctx, row_id))

@maintenance_plans_router.post("/{row_id}/resume", response_model=APIResponse[MaintenancePlanResponse])
def resume_maintenance_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:resume"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resume", data=MaintenancePlanService(db).resume(ctx, row_id))

@maintenance_plans_router.post("/{row_id}/close", response_model=APIResponse[MaintenancePlanResponse])
def close_maintenance_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance_plan:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="close", data=MaintenancePlanService(db).close(ctx, row_id))

asset_maintenances_router = APIRouter(prefix="/asset-maintenances", tags=["Asset — AssetMaintenance"])

@asset_maintenances_router.get("", response_model=APIResponse[AssetMaintenanceListResult])
def list_asset_maintenances(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    maintenance_type: str | None = None,
    q: str | None = None,
):
    items, total = MaintenanceService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        branch_id=branch_id,
        status=status,
        maintenance_type=maintenance_type,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetMaintenanceListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_maintenances_router.get("/{row_id}", response_model=APIResponse[AssetMaintenanceResponse])
def get_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MaintenanceService(db).get(ctx, row_id))

@asset_maintenances_router.post("", response_model=APIResponse[AssetMaintenanceResponse])
def create_asset_maintenances(
    body: AssetMaintenanceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=MaintenanceService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_maintenances_router.patch("/{row_id}", response_model=APIResponse[AssetMaintenanceResponse])
def update_asset_maintenances(
    row_id: UUID,
    body: AssetMaintenanceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=MaintenanceService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_maintenances_router.post("/{row_id}/submit", response_model=APIResponse[AssetMaintenanceResponse])
def submit_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=MaintenanceService(db).submit(ctx, row_id))

@asset_maintenances_router.post("/{row_id}/approve", response_model=APIResponse[AssetMaintenanceResponse])
def approve_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="approve", data=MaintenanceService(db).approve(ctx, row_id, comments=comments))

@asset_maintenances_router.post("/{row_id}/reject", response_model=APIResponse[AssetMaintenanceResponse])
def reject_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="reject", data=MaintenanceService(db).reject(ctx, row_id, comments=comments))

@asset_maintenances_router.post("/{row_id}/cancel", response_model=APIResponse[AssetMaintenanceResponse])
def cancel_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=MaintenanceService(db).cancel_draft(ctx, row_id))

@asset_maintenances_router.post("/{row_id}/reopen", response_model=APIResponse[AssetMaintenanceResponse])
def reopen_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=MaintenanceService(db).reopen(ctx, row_id))

@asset_maintenances_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetMaintenanceResponse])
def resubmit_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=MaintenanceService(db).resubmit(ctx, row_id))

@asset_maintenances_router.post("/{row_id}/schedule", response_model=APIResponse[AssetMaintenanceResponse])
def schedule_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:complete"))],
    db: Annotated[Session, Depends(get_db)],
    body: MaintenanceScheduleRequest | None = None,
):
    scheduled_date = body.scheduled_date if body else None
    return APIResponse(
        message="schedule",
        data=MaintenanceService(db).schedule(ctx, row_id, scheduled_date=scheduled_date),
    )

@asset_maintenances_router.post("/{row_id}/start", response_model=APIResponse[AssetMaintenanceResponse])
def start_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="start", data=MaintenanceService(db).start(ctx, row_id))

@asset_maintenances_router.post("/{row_id}/complete", response_model=APIResponse[AssetMaintenanceResponse])
def complete_asset_maintenances(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=MaintenanceService(db).complete(ctx, row_id))

service_histories_router = APIRouter(prefix="/service-histories", tags=["Asset — ServiceHistory"])

@service_histories_router.get("", response_model=APIResponse[ServiceHistoryListResult])
def list_service_histories(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    maintenance_id: UUID | None = None,
    branch_id: UUID | None = None,
    serviced_from: datetime | None = None,
    serviced_to: datetime | None = None,
    q: str | None = None,
):
    items, total = ServiceHistoryService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        maintenance_id=maintenance_id,
        branch_id=branch_id,
        serviced_from=serviced_from,
        serviced_to=serviced_to,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = ServiceHistoryListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@service_histories_router.get("/{row_id}", response_model=APIResponse[ServiceHistoryResponse])
def get_service_histories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceHistoryService(db).get(ctx, row_id))

@service_histories_router.post("", response_model=APIResponse[ServiceHistoryResponse])
def create_service_histories(
    body: ServiceHistoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.maintenance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=ServiceHistoryService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

asset_depreciations_router = APIRouter(prefix="/asset-depreciations", tags=["Asset — AssetDepreciation"])

@asset_depreciations_router.get("", response_model=APIResponse[AssetDepreciationListResult])
def list_asset_depreciations(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    status: str | None = None,
    method: str | None = None,
    period_year: int | None = None,
    period_month: int | None = None,
    depreciation_batch_id: UUID | None = None,
    q: str | None = None,
):
    items, total = DepreciationService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        status=status,
        method=method,
        period_year=period_year,
        period_month=period_month,
        depreciation_batch_id=depreciation_batch_id,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetDepreciationListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_depreciations_router.post(
    "/generate-run",
    response_model=APIResponse[DepreciationGenerateRunResult],
)
def generate_asset_depreciation_run(
    body: DepreciationGenerateRunRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:calculate"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = DepreciationService(db).generate_period_run(
        ctx,
        period_year=body.period_year,
        period_month=body.period_month,
        company_id=body.company_id,
    )
    return APIResponse(message="Generated", data=data)

@asset_depreciations_router.get("/{row_id}", response_model=APIResponse[AssetDepreciationResponse])
def get_asset_depreciations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DepreciationService(db).get(ctx, row_id))

@asset_depreciations_router.post("", response_model=APIResponse[AssetDepreciationResponse])
def create_asset_depreciations(
    body: AssetDepreciationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:calculate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=DepreciationService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_depreciations_router.patch("/{row_id}", response_model=APIResponse[AssetDepreciationResponse])
def update_asset_depreciations(
    row_id: UUID,
    body: AssetDepreciationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=DepreciationService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_depreciations_router.post("/{row_id}/calculate", response_model=APIResponse[AssetDepreciationResponse])
def calculate_asset_depreciations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:calculate"))],
    db: Annotated[Session, Depends(get_db)],
    body: DepreciationCalculateRequest | None = None,
):
    data = DepreciationService(db).calculate(
        ctx,
        row_id,
        estimated_total_units=body.estimated_total_units if body else None,
        units_produced=body.units_produced if body else None,
    )
    return APIResponse(message="calculate", data=data)

@asset_depreciations_router.post("/{row_id}/post", response_model=APIResponse[AssetDepreciationResponse])
def post_asset_depreciations(
    row_id: UUID,
    body: FinancePostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = DepreciationService(db).post(
        ctx,
        row_id,
        debit_account_id=body.debit_account_id,
        credit_account_id=body.credit_account_id,
        fiscal_year_id=body.fiscal_year_id,
    )
    return APIResponse(message="Posted", data=data)

@asset_depreciations_router.post("/{row_id}/reverse", response_model=APIResponse[AssetDepreciationResponse])
def reverse_asset_depreciations(
    row_id: UUID,
    body: FinancePostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.depreciation:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = DepreciationService(db).reverse(
        ctx,
        row_id,
        debit_account_id=body.debit_account_id,
        credit_account_id=body.credit_account_id,
        fiscal_year_id=body.fiscal_year_id,
    )
    return APIResponse(message="Reversed", data=data)

asset_disposals_router = APIRouter(prefix="/asset-disposals", tags=["Asset — AssetDisposal"])

@asset_disposals_router.get("", response_model=APIResponse[AssetDisposalListResult])
def list_asset_disposals(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    disposal_type: str | None = None,
    q: str | None = None,
):
    items, total = DisposalService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        branch_id=branch_id,
        status=status,
        disposal_type=disposal_type,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetDisposalListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_disposals_router.get("/{row_id}", response_model=APIResponse[AssetDisposalResponse])
def get_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DisposalService(db).get(ctx, row_id))

@asset_disposals_router.post("", response_model=APIResponse[AssetDisposalResponse])
def create_asset_disposals(
    body: AssetDisposalCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=DisposalService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_disposals_router.patch("/{row_id}", response_model=APIResponse[AssetDisposalResponse])
def update_asset_disposals(
    row_id: UUID,
    body: AssetDisposalUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=DisposalService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_disposals_router.post("/{row_id}/submit", response_model=APIResponse[AssetDisposalResponse])
def submit_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DisposalService(db).submit(ctx, row_id))

@asset_disposals_router.post("/{row_id}/approve", response_model=APIResponse[AssetDisposalResponse])
def approve_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="approve", data=DisposalService(db).approve(ctx, row_id, comments=comments))

@asset_disposals_router.post("/{row_id}/reject", response_model=APIResponse[AssetDisposalResponse])
def reject_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="reject", data=DisposalService(db).reject(ctx, row_id, comments=comments))

@asset_disposals_router.post("/{row_id}/cancel", response_model=APIResponse[AssetDisposalResponse])
def cancel_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=DisposalService(db).cancel_draft(ctx, row_id))

@asset_disposals_router.post("/{row_id}/reopen", response_model=APIResponse[AssetDisposalResponse])
def reopen_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=DisposalService(db).reopen(ctx, row_id))

@asset_disposals_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetDisposalResponse])
def resubmit_asset_disposals(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=DisposalService(db).resubmit(ctx, row_id))

@asset_disposals_router.post("/{row_id}/post", response_model=APIResponse[AssetDisposalResponse])
def post_asset_disposals(
    row_id: UUID,
    body: FinancePostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.disposal:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = DisposalService(db).post(
        ctx,
        row_id,
        debit_account_id=body.debit_account_id,
        credit_account_id=body.credit_account_id,
        fiscal_year_id=body.fiscal_year_id,
    )
    return APIResponse(message="Posted", data=data)

asset_revaluations_router = APIRouter(prefix="/asset-revaluations", tags=["Asset — AssetRevaluation"])

@asset_revaluations_router.get("", response_model=APIResponse[AssetRevaluationListResult])
def list_asset_revaluations(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
):
    items, total = RevaluationService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        branch_id=branch_id,
        status=status,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetRevaluationListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_revaluations_router.get("/{row_id}", response_model=APIResponse[AssetRevaluationResponse])
def get_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RevaluationService(db).get(ctx, row_id))

@asset_revaluations_router.post("", response_model=APIResponse[AssetRevaluationResponse])
def create_asset_revaluations(
    body: AssetRevaluationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=RevaluationService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_revaluations_router.patch("/{row_id}", response_model=APIResponse[AssetRevaluationResponse])
def update_asset_revaluations(
    row_id: UUID,
    body: AssetRevaluationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=RevaluationService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_revaluations_router.post("/{row_id}/submit", response_model=APIResponse[AssetRevaluationResponse])
def submit_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=RevaluationService(db).submit(ctx, row_id))

@asset_revaluations_router.post("/{row_id}/approve", response_model=APIResponse[AssetRevaluationResponse])
def approve_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="approve", data=RevaluationService(db).approve(ctx, row_id, comments=comments))

@asset_revaluations_router.post("/{row_id}/reject", response_model=APIResponse[AssetRevaluationResponse])
def reject_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:approve"))],
    db: Annotated[Session, Depends(get_db)],
    body: WorkflowActionRequest | None = None,
):
    comments = body.comments if body else None
    return APIResponse(message="reject", data=RevaluationService(db).reject(ctx, row_id, comments=comments))

@asset_revaluations_router.post("/{row_id}/cancel", response_model=APIResponse[AssetRevaluationResponse])
def cancel_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=RevaluationService(db).cancel_draft(ctx, row_id))

@asset_revaluations_router.post("/{row_id}/reopen", response_model=APIResponse[AssetRevaluationResponse])
def reopen_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reopen", data=RevaluationService(db).reopen(ctx, row_id))

@asset_revaluations_router.post("/{row_id}/resubmit", response_model=APIResponse[AssetRevaluationResponse])
def resubmit_asset_revaluations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="resubmit", data=RevaluationService(db).resubmit(ctx, row_id))

@asset_revaluations_router.post("/{row_id}/post", response_model=APIResponse[AssetRevaluationResponse])
def post_asset_revaluations(
    row_id: UUID,
    body: FinancePostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.revaluation:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = RevaluationService(db).post(
        ctx,
        row_id,
        debit_account_id=body.debit_account_id,
        credit_account_id=body.credit_account_id,
        fiscal_year_id=body.fiscal_year_id,
    )
    return APIResponse(message="Posted", data=data)

asset_audits_router = APIRouter(prefix="/asset-audits", tags=["Asset — AssetAudit"])

@asset_audits_router.get("", response_model=APIResponse[AssetAuditListResult])
def list_asset_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    auditor_employee_id: UUID | None = None,
    status: str | None = None,
    found_status: str | None = None,
    q: str | None = None,
):
    items, total = AssetAuditService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        auditor_employee_id=auditor_employee_id,
        status=status,
        found_status=found_status,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetAuditListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_audits_router.get("/{row_id}", response_model=APIResponse[AssetAuditResponse])
def get_asset_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetAuditService(db).get(ctx, row_id))

@asset_audits_router.post("", response_model=APIResponse[AssetAuditResponse])
def create_asset_audits(
    body: AssetAuditCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=AssetAuditService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )

@asset_audits_router.patch("/{row_id}", response_model=APIResponse[AssetAuditResponse])
def update_asset_audits(
    row_id: UUID,
    body: AssetAuditUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssetAuditService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_audits_router.post("/{row_id}/start", response_model=APIResponse[AssetAuditResponse])
def start_asset_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="start", data=AssetAuditService(db).start(ctx, row_id))

@asset_audits_router.post("/{row_id}/complete", response_model=APIResponse[AssetAuditResponse])
def complete_asset_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=AssetAuditService(db).complete(ctx, row_id))

@asset_audits_router.post("/{row_id}/cancel", response_model=APIResponse[AssetAuditResponse])
def cancel_asset_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.audit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=AssetAuditService(db).cancel(ctx, row_id))

asset_documents_router = APIRouter(prefix="/asset-documents", tags=["Asset — AssetDocument"])

@asset_documents_router.get("", response_model=APIResponse[AssetDocumentListResult])
def list_asset_documents(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    document_type: str | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
):
    items, total = DocumentService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        document_type=document_type,
        branch_id=branch_id,
        status=status,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetDocumentListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_documents_router.get("/{row_id}", response_model=APIResponse[AssetDocumentResponse])
def get_asset_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentService(db).get(ctx, row_id))

@asset_documents_router.post("", response_model=APIResponse[AssetDocumentResponse])
def create_asset_documents(
    body: AssetDocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=DocumentService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_documents_router.patch("/{row_id}", response_model=APIResponse[AssetDocumentResponse])
def update_asset_documents(
    row_id: UUID,
    body: AssetDocumentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=DocumentService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_documents_router.post("/{row_id}/supersede", response_model=APIResponse[AssetDocumentResponse])
def supersede_asset_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="supersede", data=DocumentService(db).supersede(ctx, row_id))

@asset_documents_router.post("/{row_id}/archive", response_model=APIResponse[AssetDocumentResponse])
def archive_asset_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="archive", data=DocumentService(db).archive(ctx, row_id))

asset_checklists_router = APIRouter(prefix="/asset-checklists", tags=["Asset — AssetChecklist"])

@asset_checklists_router.get("", response_model=APIResponse[AssetChecklistListResult])
def list_asset_checklists(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    maintenance_id: UUID | None = None,
    audit_id: UUID | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
):
    items, total = ChecklistService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        maintenance_id=maintenance_id,
        audit_id=audit_id,
        branch_id=branch_id,
        status=status,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetChecklistListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_checklists_router.get("/{row_id}", response_model=APIResponse[AssetChecklistResponse])
def get_asset_checklists(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ChecklistService(db).get(ctx, row_id))

@asset_checklists_router.post("", response_model=APIResponse[AssetChecklistResponse])
def create_asset_checklists(
    body: AssetChecklistCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=ChecklistService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_checklists_router.patch("/{row_id}", response_model=APIResponse[AssetChecklistResponse])
def update_asset_checklists(
    row_id: UUID,
    body: AssetChecklistUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=ChecklistService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_checklists_router.post("/{row_id}/complete", response_model=APIResponse[AssetChecklistResponse])
def complete_asset_checklists(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ChecklistService(db).complete(ctx, row_id))

@asset_checklists_router.post("/{row_id}/cancel", response_model=APIResponse[AssetChecklistResponse])
def cancel_asset_checklists(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.checklist:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="cancel", data=ChecklistService(db).cancel(ctx, row_id))

meter_readings_router = APIRouter(prefix="/meter-readings", tags=["Asset — MeterReading"])

@meter_readings_router.get("", response_model=APIResponse[MeterReadingListResult])
def list_meter_readings(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.meter:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    meter_type: str | None = None,
    branch_id: UUID | None = None,
    status: str | None = None,
    reading_from: datetime | None = None,
    reading_to: datetime | None = None,
    q: str | None = None,
):
    items, total = MeterReadingService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        meter_type=meter_type,
        branch_id=branch_id,
        status=status,
        reading_from=reading_from,
        reading_to=reading_to,
        search=q,
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = MeterReadingListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@meter_readings_router.get("/{row_id}", response_model=APIResponse[MeterReadingResponse])
def get_meter_readings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.meter:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MeterReadingService(db).get(ctx, row_id))

@meter_readings_router.post("", response_model=APIResponse[MeterReadingResponse])
def create_meter_readings(
    body: MeterReadingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.meter:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=MeterReadingService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@meter_readings_router.post("/{row_id}/void", response_model=APIResponse[MeterReadingResponse])
def void_meter_readings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.meter:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="void", data=MeterReadingService(db).void(ctx, row_id))

asset_notifications_router = APIRouter(prefix="/asset-notifications", tags=["Asset — AssetNotification"])

@asset_notifications_router.get("", response_model=APIResponse[AssetNotificationListResult])
def list_asset_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    asset_id: UUID | None = None,
    notification_type: str | None = None,
    delivery_status: str | None = None,
    status: str | None = None,
    recipient_user_id: UUID | None = None,
    branch_id: UUID | None = None,
    sort: str | None = None,
    q: str | None = None,
):
    items, total = AssetNotificationService(db).search(
        ctx,
        company_id=company_id,
        asset_id=asset_id,
        notification_type=notification_type,
        delivery_status=delivery_status,
        status=status,
        recipient_user_id=recipient_user_id,
        branch_id=branch_id,
        search=q,
        sort=sort or "created_at",
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    payload = AssetNotificationListResult(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=payload)

@asset_notifications_router.get("/{row_id}", response_model=APIResponse[AssetNotificationResponse])
def get_asset_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetNotificationService(db).get(ctx, row_id))

@asset_notifications_router.post("", response_model=APIResponse[AssetNotificationResponse])
def create_asset_notifications(
    body: AssetNotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=AssetNotificationService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )

@asset_notifications_router.patch("/{row_id}", response_model=APIResponse[AssetNotificationResponse])
def update_asset_notifications(
    row_id: UUID,
    body: AssetNotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssetNotificationService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@asset_notifications_router.post("/{row_id}/archive", response_model=APIResponse[AssetNotificationResponse])
def archive_asset_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="archive", data=AssetNotificationService(db).archive(ctx, row_id))

@asset_notifications_router.post("/{row_id}/mark-read", response_model=APIResponse[AssetNotificationResponse])
def mark_read_asset_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="mark-read", data=AssetNotificationService(db).mark_read(ctx, row_id))

@asset_notifications_router.post("/{row_id}/mark-sent", response_model=APIResponse[AssetNotificationResponse])
def mark_sent_asset_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="mark-sent", data=AssetNotificationService(db).mark_sent(ctx, row_id))

@asset_notifications_router.post("/{row_id}/mark-failed", response_model=APIResponse[AssetNotificationResponse])
def mark_failed_asset_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="mark-failed", data=AssetNotificationService(db).mark_failed(ctx, row_id))

reports_router = APIRouter(prefix="/reports", tags=["Asset — AssetReport"])

@reports_router.get("/catalog", response_model=APIResponse[list[AssetReportCatalogItem]])
def catalog_asset_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = AssetReportService(db).catalog()
    return APIResponse(message="OK", data=[AssetReportCatalogItem(**i) for i in items])

@reports_router.get("/dashboard", response_model=APIResponse[AssetReportDashboardResponse])
def dashboard_asset_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    category_id: UUID | None = None,
    department_id: UUID | None = None,
    horizon_days: int = 30,
):
    data = AssetReportService(db).dashboard(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        category_id=category_id,
        department_id=department_id,
        horizon_days=horizon_days,
    )
    return APIResponse(message="OK", data=data)

@reports_router.get("/run/{report_key}", response_model=APIResponse[AssetReportRunResult])
def run_asset_report(
    report_key: str,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    category_id: UUID | None = None,
    department_id: UUID | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    status: str | None = None,
):
    data = AssetReportService(db).run(
        ctx,
        report_key,
        company_id=company_id,
        branch_id=branch_id,
        category_id=category_id,
        department_id=department_id,
        period_start=period_start,
        period_end=period_end,
        status=status,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return APIResponse(message="OK", data=data)

@reports_router.get("/export/{report_key}", response_model=APIResponse[AssetReportExportResult])
def export_asset_report(
    report_key: str,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:export"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    category_id: UUID | None = None,
    department_id: UUID | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    status: str | None = None,
):
    data = AssetReportService(db).export(
        ctx,
        report_key,
        company_id=company_id,
        branch_id=branch_id,
        category_id=category_id,
        department_id=department_id,
        period_start=period_start,
        period_end=period_end,
        status=status,
    )
    return APIResponse(message="OK", data=data)

@reports_router.post("/generate", response_model=APIResponse[AssetReportResponse])
def generate_asset_report(
    body: AssetReportGenerate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Generated",
        data=AssetReportService(db).generate(ctx, **body.model_dump(exclude_none=True)),
    )

@reports_router.get("", response_model=APIResponse[AssetReportListResult])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    report_type: str | None = None,
    status: str | None = None,
    category_id: UUID | None = None,
    department_id: UUID | None = None,
    branch_id: UUID | None = None,
    sort: str | None = None,
    q: str | None = None,
):
    items, total = AssetReportService(db).search(
        ctx,
        company_id=company_id,
        report_type=report_type,
        status=status,
        category_id=category_id,
        department_id=department_id,
        branch_id=branch_id,
        search=q,
        sort=sort or "generated_at",
        offset=pagination.offset,
        limit=pagination.page_size,
    )
    return APIResponse(
        message="OK",
        data=AssetReportListResult(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        ),
    )

@reports_router.get("/{row_id}", response_model=APIResponse[AssetReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[AssetReportResponse])
def create_reports(
    body: AssetReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=AssetReportService(db).generate(ctx, **body.model_dump(exclude_none=True)),
    )

@reports_router.patch("/{row_id}", response_model=APIResponse[AssetReportResponse])
def update_reports(
    row_id: UUID,
    body: AssetReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=AssetReportService(db).update(ctx, row_id, **body.model_dump(exclude_unset=True)),
    )

@reports_router.post("/{row_id}/finalize", response_model=APIResponse[AssetReportResponse])
def finalize_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="finalize", data=AssetReportService(db).finalize(ctx, row_id))

