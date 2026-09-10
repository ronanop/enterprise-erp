"""Quality REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_pagination,
    paginate,
)
from modules.quality.schemas import (
    CapaCreateRequest,
    CapaResponse,
    CapaUpdateRequest,
    CharacteristicCreateRequest,
    CharacteristicResponse,
    CharacteristicUpdateRequest,
    CustomerComplaintCreateRequest,
    CustomerComplaintResponse,
    CustomerComplaintUpdateRequest,
    DefectCreateRequest,
    DefectLinkNcrRequest,
    DefectResponse,
    DefectTypeCreateRequest,
    DefectTypeResponse,
    DefectTypeUpdateRequest,
    DefectUpdateRequest,
    FinalCompleteRequest,
    FinalInspectionCreateRequest,
    FinalInspectionResponse,
    FinalInspectionUpdateRequest,
    IncomingApproveRequest,
    IncomingInspectionCreateRequest,
    IncomingInspectionResponse,
    IncomingInspectionUpdateRequest,
    IncomingLinesAddRequest,
    InprocessInspectionCreateRequest,
    InprocessInspectionResponse,
    InprocessInspectionUpdateRequest,
    InspectionPlanCreateRequest,
    InspectionPlanResponse,
    InspectionPlanUpdateRequest,
    NcrCreateRequest,
    NcrResponse,
    NcrUpdateRequest,
    QualityAuditCreateRequest,
    QualityAuditResponse,
    QualityAuditUpdateRequest,
    QualityScoreCreateRequest,
    QualityScorePublishRequest,
    QualityScoreResponse,
    QualityScoreUpdateRequest,
    ReportSummaryResponse,
    SamplingPlanCreateRequest,
    SamplingPlanResponse,
    SamplingPlanUpdateRequest,
    PfmeaCreateRequest,
    PfmeaResponse,
    PfmeaUpdateRequest,
    PpapCreateRequest,
    PpapResponse,
    PpapUpdateRequest,
    SpcCapabilityResponse,
    SpcReadingCreateRequest,
    SpcReadingResponse,
    ScarCreateRequest,
    ScarRecordResponseRequest,
    ScarResponse,
    ScarUpdateRequest,
    VinTraceCreateRequest,
    VinTraceResponse,
    VinTraceUpdateRequest,
    WarrantyClaimCreateRequest,
    WarrantyClaimResponse,
    WarrantyClaimUpdateRequest,
    WarrantyLinkCapaRequest,
    RecallCreateRequest,
    RecallResponse,
    RecallUpdateRequest,
    SupplierQualityCreateRequest,
    SupplierQualityResponse,
    SupplierQualityUpdateRequest,
)
from modules.quality.service import (
    CapaService,
    CharacteristicService,
    CustomerComplaintService,
    DefectService,
    DefectTypeService,
    FinalInspectionService,
    IncomingInspectionService,
    InProcessInspectionService,
    InspectionPlanService,
    NcrService,
    QualityAuditService,
    QualityReportService,
    QualityScoreService,
    SamplingPlanService,
    SupplierQualityService,
    PfmeaService,
    PpapService,
    ScarService,
    SpcReadingService,
    VinTraceService,
    WarrantyClaimService,
    RecallService,
)
from shared.schemas import APIResponse

plans_router = APIRouter(prefix="/plans", tags=["Quality - Inspection Plans"])
sampling_plans_router = APIRouter(prefix="/sampling-plans", tags=["Quality - Sampling Plans"])
characteristics_router = APIRouter(prefix="/characteristics", tags=["Quality - Characteristics"])
defect_types_router = APIRouter(prefix="/defect-types", tags=["Quality - Defect Types"])
incoming_router = APIRouter(prefix="/incoming-inspections", tags=["Quality - Incoming Inspections"])
inprocess_router = APIRouter(prefix="/inprocess-inspections", tags=["Quality - In-Process Inspections"])
final_router = APIRouter(prefix="/final-inspections", tags=["Quality - Final Inspections"])
defects_router = APIRouter(prefix="/defects", tags=["Quality - Defects"])
ncrs_router = APIRouter(prefix="/ncrs", tags=["Quality - NCRs"])
capas_router = APIRouter(prefix="/capas", tags=["Quality - CAPAs"])
supplier_quality_router = APIRouter(prefix="/supplier-quality", tags=["Quality - Supplier Quality"])
complaints_router = APIRouter(prefix="/complaints", tags=["Quality - Complaints"])
audits_router = APIRouter(prefix="/audits", tags=["Quality - Audits"])
scores_router = APIRouter(prefix="/scores", tags=["Quality - Scores"])
reports_router = APIRouter(prefix="/reports", tags=["Quality - Reports"])
pfmeas_router = APIRouter(prefix="/pfmeas", tags=["Quality - PFMEA"])
ppaps_router = APIRouter(prefix="/ppaps", tags=["Quality - PPAP"])
spc_readings_router = APIRouter(prefix="/spc-readings", tags=["Quality - SPC Readings"])
scars_router = APIRouter(prefix="/scars", tags=["Quality - SCARs"])
vin_traces_router = APIRouter(prefix="/vin-traces", tags=["Quality - VIN Trace"])
warranty_claims_router = APIRouter(prefix="/warranty-claims", tags=["Quality - Warranty Claims"])
recalls_router = APIRouter(prefix="/recalls", tags=["Quality - Recalls"])


@plans_router.get("", response_model=APIResponse[list[InspectionPlanResponse]])
def list_plans(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inspection_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    inspection_type: str | None = None,
):
    rows = InspectionPlanService(db).list_plans(ctx, company_id, inspection_type)
    return APIResponse(
        message="Inspection plans retrieved",
        data=[InspectionPlanResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@plans_router.post("", response_model=APIResponse[InspectionPlanResponse])
def create_plan(
    body: InspectionPlanCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inspection_plan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InspectionPlanService(db).create_plan(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Inspection plan created", data=InspectionPlanResponse.model_validate(row))


@plans_router.get("/{plan_id}", response_model=APIResponse[InspectionPlanResponse])
def get_plan(
    plan_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inspection_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InspectionPlanService(db).get_plan(ctx, plan_id)
    return APIResponse(message="Inspection plan retrieved", data=InspectionPlanResponse.model_validate(row))


@plans_router.patch("/{plan_id}", response_model=APIResponse[InspectionPlanResponse])
def update_plan(
    plan_id: UUID,
    body: InspectionPlanUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inspection_plan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InspectionPlanService(db).update_plan(ctx, plan_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Inspection plan updated", data=InspectionPlanResponse.model_validate(row))


@plans_router.post("/{plan_id}/activate", response_model=APIResponse[InspectionPlanResponse])
def activate_plan(
    plan_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inspection_plan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InspectionPlanService(db).activate(ctx, plan_id)
    db.commit()
    return APIResponse(message="Inspection plan activated", data=InspectionPlanResponse.model_validate(row))


@sampling_plans_router.get("", response_model=APIResponse[list[SamplingPlanResponse]])
def list_sampling_plans(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.sampling_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = SamplingPlanService(db).list_plans(ctx, company_id)
    return APIResponse(
        message="Sampling plans retrieved",
        data=[SamplingPlanResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@sampling_plans_router.post("", response_model=APIResponse[SamplingPlanResponse])
def create_sampling_plan(
    body: SamplingPlanCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.sampling_plan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SamplingPlanService(db).create_plan(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Sampling plan created", data=SamplingPlanResponse.model_validate(row))


@sampling_plans_router.get("/{plan_id}", response_model=APIResponse[SamplingPlanResponse])
def get_sampling_plan(
    plan_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.sampling_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SamplingPlanService(db).get_plan(ctx, plan_id)
    return APIResponse(message="Sampling plan retrieved", data=SamplingPlanResponse.model_validate(row))


@sampling_plans_router.patch("/{plan_id}", response_model=APIResponse[SamplingPlanResponse])
def update_sampling_plan(
    plan_id: UUID,
    body: SamplingPlanUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.sampling_plan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SamplingPlanService(db).update_plan(ctx, plan_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Sampling plan updated", data=SamplingPlanResponse.model_validate(row))


@characteristics_router.get("", response_model=APIResponse[list[CharacteristicResponse]])
def list_characteristics(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.characteristic:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    inspection_plan_id: UUID | None = None,
):
    rows = CharacteristicService(db).list_characteristics(ctx, company_id, inspection_plan_id)
    return APIResponse(
        message="Characteristics retrieved",
        data=[CharacteristicResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@characteristics_router.post("", response_model=APIResponse[CharacteristicResponse])
def create_characteristic(
    body: CharacteristicCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.characteristic:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CharacteristicService(db).create_characteristic(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Characteristic created", data=CharacteristicResponse.model_validate(row))


@characteristics_router.get(
    "/{characteristic_id}", response_model=APIResponse[CharacteristicResponse]
)
def get_characteristic(
    characteristic_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.characteristic:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CharacteristicService(db).get_characteristic(ctx, characteristic_id)
    return APIResponse(
        message="Characteristic retrieved",
        data=CharacteristicResponse.model_validate(row),
    )


@characteristics_router.patch("/{characteristic_id}", response_model=APIResponse[CharacteristicResponse])
def update_characteristic(
    characteristic_id: UUID,
    body: CharacteristicUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.characteristic:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CharacteristicService(db).update_characteristic(
        ctx, characteristic_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Characteristic updated", data=CharacteristicResponse.model_validate(row))


@defect_types_router.get("", response_model=APIResponse[list[DefectTypeResponse]])
def list_defect_types(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect_type:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = DefectTypeService(db).list_types(ctx, company_id)
    return APIResponse(
        message="Defect types retrieved",
        data=[DefectTypeResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@defect_types_router.post("", response_model=APIResponse[DefectTypeResponse])
def create_defect_type(
    body: DefectTypeCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect_type:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectTypeService(db).create_type(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Defect type created", data=DefectTypeResponse.model_validate(row))


@defect_types_router.get("/{defect_type_id}", response_model=APIResponse[DefectTypeResponse])
def get_defect_type(
    defect_type_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect_type:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectTypeService(db).get_type(ctx, defect_type_id)
    return APIResponse(message="Defect type retrieved", data=DefectTypeResponse.model_validate(row))


@defect_types_router.patch("/{defect_type_id}", response_model=APIResponse[DefectTypeResponse])
def update_defect_type(
    defect_type_id: UUID,
    body: DefectTypeUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect_type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectTypeService(db).update_type(ctx, defect_type_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Defect type updated", data=DefectTypeResponse.model_validate(row))


@incoming_router.get("", response_model=APIResponse[list[IncomingInspectionResponse]])
def list_incoming(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = IncomingInspectionService(db).list_inspections(ctx, company_id)
    return APIResponse(
        message="Incoming inspections retrieved",
        data=[IncomingInspectionResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@incoming_router.post("", response_model=APIResponse[IncomingInspectionResponse])
def create_incoming(
    body: IncomingInspectionCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = body.model_dump()
    lines = data.pop("lines", [])
    row = IncomingInspectionService(db).create_inspection(ctx, lines=lines, **data)
    db.commit()
    return APIResponse(
        message="Incoming inspection created",
        data=IncomingInspectionResponse.model_validate(row),
    )


@incoming_router.get("/{inspection_id}", response_model=APIResponse[IncomingInspectionResponse])
def get_incoming(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = IncomingInspectionService(db).get_inspection(ctx, inspection_id)
    return APIResponse(
        message="Incoming inspection retrieved",
        data=IncomingInspectionResponse.model_validate(row),
    )


@incoming_router.patch("/{inspection_id}", response_model=APIResponse[IncomingInspectionResponse])
def update_incoming(
    inspection_id: UUID,
    body: IncomingInspectionUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = IncomingInspectionService(db).update_inspection(
        ctx, inspection_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(
        message="Incoming inspection updated",
        data=IncomingInspectionResponse.model_validate(row),
    )


@incoming_router.post("/{inspection_id}/complete", response_model=APIResponse[IncomingInspectionResponse])
def complete_incoming(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = IncomingInspectionService(db).complete(ctx, inspection_id)
    db.commit()
    return APIResponse(
        message="Incoming inspection completed",
        data=IncomingInspectionResponse.model_validate(row),
    )


@incoming_router.post("/{inspection_id}/approve", response_model=APIResponse[IncomingInspectionResponse])
def approve_incoming(
    inspection_id: UUID,
    body: IncomingApproveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = IncomingInspectionService(db).approve(ctx, inspection_id, **body.model_dump())
    db.commit()
    return APIResponse(
        message="Incoming inspection approved",
        data=IncomingInspectionResponse.model_validate(row),
    )


@incoming_router.post("/{inspection_id}/lines", response_model=APIResponse[IncomingInspectionResponse])
def add_incoming_lines(
    inspection_id: UUID,
    body: IncomingLinesAddRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.incoming_inspection:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    lines = [ln.model_dump() for ln in body.lines]
    row = IncomingInspectionService(db).add_lines(ctx, inspection_id, lines)
    db.commit()
    return APIResponse(
        message="Checklist lines added",
        data=IncomingInspectionResponse.model_validate(row),
    )


@inprocess_router.get("", response_model=APIResponse[list[InprocessInspectionResponse]])
def list_inprocess(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inprocess_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = InProcessInspectionService(db).list_inspections(ctx, company_id)
    return APIResponse(
        message="In-process inspections retrieved",
        data=[InprocessInspectionResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@inprocess_router.post("", response_model=APIResponse[InprocessInspectionResponse])
def create_inprocess(
    body: InprocessInspectionCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inprocess_inspection:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InProcessInspectionService(db).create_inspection(ctx, **body.model_dump())
    db.commit()
    return APIResponse(
        message="In-process inspection created",
        data=InprocessInspectionResponse.model_validate(row),
    )


@inprocess_router.get("/{inspection_id}", response_model=APIResponse[InprocessInspectionResponse])
def get_inprocess(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inprocess_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InProcessInspectionService(db).get_inspection(ctx, inspection_id)
    return APIResponse(
        message="In-process inspection retrieved",
        data=InprocessInspectionResponse.model_validate(row),
    )


@inprocess_router.patch("/{inspection_id}", response_model=APIResponse[InprocessInspectionResponse])
def update_inprocess(
    inspection_id: UUID,
    body: InprocessInspectionUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inprocess_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InProcessInspectionService(db).update_inspection(
        ctx, inspection_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(
        message="In-process inspection updated",
        data=InprocessInspectionResponse.model_validate(row),
    )


@inprocess_router.post("/{inspection_id}/complete", response_model=APIResponse[InprocessInspectionResponse])
def complete_inprocess(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.inprocess_inspection:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = InProcessInspectionService(db).complete(ctx, inspection_id)
    db.commit()
    return APIResponse(
        message="In-process inspection completed",
        data=InprocessInspectionResponse.model_validate(row),
    )


@final_router.get("", response_model=APIResponse[list[FinalInspectionResponse]])
def list_final(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = FinalInspectionService(db).list_inspections(ctx, company_id)
    return APIResponse(
        message="Final inspections retrieved",
        data=[FinalInspectionResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@final_router.post("", response_model=APIResponse[FinalInspectionResponse])
def create_final(
    body: FinalInspectionCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).create_inspection(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Final inspection created", data=FinalInspectionResponse.model_validate(row))


@final_router.get("/{inspection_id}", response_model=APIResponse[FinalInspectionResponse])
def get_final(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).get_inspection(ctx, inspection_id)
    return APIResponse(
        message="Final inspection retrieved",
        data=FinalInspectionResponse.model_validate(row),
    )


@final_router.patch("/{inspection_id}", response_model=APIResponse[FinalInspectionResponse])
def update_final(
    inspection_id: UUID,
    body: FinalInspectionUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).update_inspection(
        ctx, inspection_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Final inspection updated", data=FinalInspectionResponse.model_validate(row))


@final_router.post("/{inspection_id}/submit", response_model=APIResponse[FinalInspectionResponse])
def submit_final(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).submit(ctx, inspection_id)
    db.commit()
    return APIResponse(message="Final inspection submitted", data=FinalInspectionResponse.model_validate(row))


@final_router.post("/{inspection_id}/approve", response_model=APIResponse[FinalInspectionResponse])
def approve_final(
    inspection_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).approve(ctx, inspection_id)
    db.commit()
    return APIResponse(message="Final inspection approved", data=FinalInspectionResponse.model_validate(row))


@final_router.post("/{inspection_id}/complete", response_model=APIResponse[FinalInspectionResponse])
def complete_final(
    inspection_id: UUID,
    body: FinalCompleteRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.final_inspection:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = FinalInspectionService(db).complete(ctx, inspection_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Final inspection completed", data=FinalInspectionResponse.model_validate(row))


@defects_router.get("", response_model=APIResponse[list[DefectResponse]])
def list_defects(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    ncr_id: UUID | None = None,
):
    rows = DefectService(db).list_defects(ctx, company_id, ncr_id)
    return APIResponse(
        message="Defects retrieved",
        data=[DefectResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@defects_router.post("", response_model=APIResponse[DefectResponse])
def create_defect(
    body: DefectCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectService(db).create_defect(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Defect created", data=DefectResponse.model_validate(row))


@defects_router.get("/{defect_id}", response_model=APIResponse[DefectResponse])
def get_defect(
    defect_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectService(db).get_defect(ctx, defect_id)
    return APIResponse(message="Defect retrieved", data=DefectResponse.model_validate(row))


@defects_router.patch("/{defect_id}", response_model=APIResponse[DefectResponse])
def update_defect(
    defect_id: UUID,
    body: DefectUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectService(db).update_defect(ctx, defect_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Defect updated", data=DefectResponse.model_validate(row))


@defects_router.post("/{defect_id}/link-ncr", response_model=APIResponse[DefectResponse])
def link_defect_ncr(
    defect_id: UUID,
    body: DefectLinkNcrRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.defect:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DefectService(db).link_to_ncr(ctx, defect_id, body.ncr_id)
    db.commit()
    return APIResponse(message="Defect linked to NCR", data=DefectResponse.model_validate(row))


@ncrs_router.get("", response_model=APIResponse[list[NcrResponse]])
def list_ncrs(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = NcrService(db).list_ncrs(ctx, company_id)
    return APIResponse(
        message="NCRs retrieved",
        data=[NcrResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@ncrs_router.post("", response_model=APIResponse[NcrResponse])
def create_ncr(
    body: NcrCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).create_ncr(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="NCR created", data=NcrResponse.model_validate(row))


@ncrs_router.get("/{ncr_id}", response_model=APIResponse[NcrResponse])
def get_ncr(
    ncr_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).get_ncr(ctx, ncr_id)
    return APIResponse(message="NCR retrieved", data=NcrResponse.model_validate(row))


@ncrs_router.patch("/{ncr_id}", response_model=APIResponse[NcrResponse])
def update_ncr(
    ncr_id: UUID,
    body: NcrUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).update_ncr(ctx, ncr_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="NCR updated", data=NcrResponse.model_validate(row))


@ncrs_router.post("/{ncr_id}/submit", response_model=APIResponse[NcrResponse])
def submit_ncr(
    ncr_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).submit(ctx, ncr_id)
    db.commit()
    return APIResponse(message="NCR submitted", data=NcrResponse.model_validate(row))


@ncrs_router.post("/{ncr_id}/approve", response_model=APIResponse[NcrResponse])
def approve_ncr(
    ncr_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).approve(ctx, ncr_id)
    db.commit()
    return APIResponse(message="NCR approved", data=NcrResponse.model_validate(row))


@ncrs_router.post("/{ncr_id}/close", response_model=APIResponse[NcrResponse])
def close_ncr(
    ncr_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ncr:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = NcrService(db).close(ctx, ncr_id)
    db.commit()
    return APIResponse(message="NCR closed", data=NcrResponse.model_validate(row))


@capas_router.get("", response_model=APIResponse[list[CapaResponse]])
def list_capas(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = CapaService(db).list_capas(ctx, company_id)
    return APIResponse(
        message="CAPAs retrieved",
        data=[CapaResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@capas_router.post("", response_model=APIResponse[CapaResponse])
def create_capa(
    body: CapaCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = body.model_dump()
    root_causes = data.pop("root_causes", [])
    corrective_actions = data.pop("corrective_actions", [])
    preventive_actions = data.pop("preventive_actions", [])
    row = CapaService(db).create_capa(
        ctx,
        root_causes=root_causes,
        corrective_actions=corrective_actions,
        preventive_actions=preventive_actions,
        **data,
    )
    db.commit()
    return APIResponse(message="CAPA created", data=CapaResponse.model_validate(row))


@capas_router.get("/{capa_id}", response_model=APIResponse[CapaResponse])
def get_capa(
    capa_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).get_capa(ctx, capa_id)
    return APIResponse(message="CAPA retrieved", data=CapaResponse.model_validate(row))


@capas_router.patch("/{capa_id}", response_model=APIResponse[CapaResponse])
def update_capa(
    capa_id: UUID,
    body: CapaUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).update_capa(ctx, capa_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="CAPA updated", data=CapaResponse.model_validate(row))


@capas_router.post("/{capa_id}/submit", response_model=APIResponse[CapaResponse])
def submit_capa(
    capa_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).submit(ctx, capa_id)
    db.commit()
    return APIResponse(message="CAPA submitted", data=CapaResponse.model_validate(row))


@capas_router.post("/{capa_id}/approve", response_model=APIResponse[CapaResponse])
def approve_capa(
    capa_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).approve(ctx, capa_id)
    db.commit()
    return APIResponse(message="CAPA approved", data=CapaResponse.model_validate(row))


@capas_router.post("/{capa_id}/verify", response_model=APIResponse[CapaResponse])
def verify_capa(
    capa_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:verify"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).verify(ctx, capa_id)
    db.commit()
    return APIResponse(message="CAPA verified", data=CapaResponse.model_validate(row))


@capas_router.post("/{capa_id}/close", response_model=APIResponse[CapaResponse])
def close_capa(
    capa_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.capa:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CapaService(db).close(ctx, capa_id)
    db.commit()
    return APIResponse(message="CAPA closed", data=CapaResponse.model_validate(row))


@supplier_quality_router.get("", response_model=APIResponse[list[SupplierQualityResponse]])
def list_supplier_quality(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.supplier_quality:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    vendor_id: UUID | None = None,
):
    rows = SupplierQualityService(db).list_scores(ctx, company_id, vendor_id)
    return APIResponse(
        message="Supplier quality scores retrieved",
        data=[SupplierQualityResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@supplier_quality_router.post("", response_model=APIResponse[SupplierQualityResponse])
def create_supplier_quality(
    body: SupplierQualityCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.supplier_quality:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SupplierQualityService(db).create_score(ctx, **body.model_dump())
    db.commit()
    return APIResponse(
        message="Supplier quality score created",
        data=SupplierQualityResponse.model_validate(row),
    )


@supplier_quality_router.get("/{score_id}", response_model=APIResponse[SupplierQualityResponse])
def get_supplier_quality(
    score_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.supplier_quality:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SupplierQualityService(db).get_score(ctx, score_id)
    return APIResponse(
        message="Supplier quality score retrieved",
        data=SupplierQualityResponse.model_validate(row),
    )


@supplier_quality_router.patch("/{score_id}", response_model=APIResponse[SupplierQualityResponse])
def update_supplier_quality(
    score_id: UUID,
    body: SupplierQualityUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.supplier_quality:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SupplierQualityService(db).update_score(ctx, score_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(
        message="Supplier quality score updated",
        data=SupplierQualityResponse.model_validate(row),
    )


@supplier_quality_router.post("/{score_id}/publish", response_model=APIResponse[SupplierQualityResponse])
def publish_supplier_quality(
    score_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.supplier_quality:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SupplierQualityService(db).publish(ctx, score_id)
    db.commit()
    return APIResponse(
        message="Supplier quality score published",
        data=SupplierQualityResponse.model_validate(row),
    )


@complaints_router.get("", response_model=APIResponse[list[CustomerComplaintResponse]])
def list_complaints(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = CustomerComplaintService(db).list_complaints(ctx, company_id)
    return APIResponse(
        message="Complaints retrieved",
        data=[CustomerComplaintResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@complaints_router.post("", response_model=APIResponse[CustomerComplaintResponse])
def create_complaint(
    body: CustomerComplaintCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerComplaintService(db).create_complaint(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Complaint created", data=CustomerComplaintResponse.model_validate(row))


@complaints_router.get("/{complaint_id}", response_model=APIResponse[CustomerComplaintResponse])
def get_complaint(
    complaint_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerComplaintService(db).get_complaint(ctx, complaint_id)
    return APIResponse(
        message="Complaint retrieved",
        data=CustomerComplaintResponse.model_validate(row),
    )


@complaints_router.patch("/{complaint_id}", response_model=APIResponse[CustomerComplaintResponse])
def update_complaint(
    complaint_id: UUID,
    body: CustomerComplaintUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerComplaintService(db).update_complaint(
        ctx, complaint_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Complaint updated", data=CustomerComplaintResponse.model_validate(row))


@complaints_router.post("/{complaint_id}/investigate", response_model=APIResponse[CustomerComplaintResponse])
def investigate_complaint(
    complaint_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerComplaintService(db).investigate(ctx, complaint_id)
    db.commit()
    return APIResponse(message="Complaint investigating", data=CustomerComplaintResponse.model_validate(row))


@complaints_router.post("/{complaint_id}/close", response_model=APIResponse[CustomerComplaintResponse])
def close_complaint(
    complaint_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.customer_complaint:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerComplaintService(db).close(ctx, complaint_id)
    db.commit()
    return APIResponse(message="Complaint closed", data=CustomerComplaintResponse.model_validate(row))


@audits_router.get("", response_model=APIResponse[list[QualityAuditResponse]])
def list_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = QualityAuditService(db).list_audits(ctx, company_id)
    return APIResponse(
        message="Audits retrieved",
        data=[QualityAuditResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@audits_router.post("", response_model=APIResponse[QualityAuditResponse])
def create_audit(
    body: QualityAuditCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).create_audit(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Audit created", data=QualityAuditResponse.model_validate(row))


@audits_router.get("/{audit_id}", response_model=APIResponse[QualityAuditResponse])
def get_audit(
    audit_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).get_audit(ctx, audit_id)
    return APIResponse(message="Audit retrieved", data=QualityAuditResponse.model_validate(row))


@audits_router.patch("/{audit_id}", response_model=APIResponse[QualityAuditResponse])
def update_audit(
    audit_id: UUID,
    body: QualityAuditUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).update_audit(ctx, audit_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Audit updated", data=QualityAuditResponse.model_validate(row))


@audits_router.post("/{audit_id}/start", response_model=APIResponse[QualityAuditResponse])
def start_audit(
    audit_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).start(ctx, audit_id)
    db.commit()
    return APIResponse(message="Audit started", data=QualityAuditResponse.model_validate(row))


@audits_router.post("/{audit_id}/complete", response_model=APIResponse[QualityAuditResponse])
def complete_audit(
    audit_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).complete(ctx, audit_id)
    db.commit()
    return APIResponse(message="Audit completed", data=QualityAuditResponse.model_validate(row))


@audits_router.post("/{audit_id}/close", response_model=APIResponse[QualityAuditResponse])
def close_audit(
    audit_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.audit:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityAuditService(db).close(ctx, audit_id)
    db.commit()
    return APIResponse(message="Audit closed", data=QualityAuditResponse.model_validate(row))


@scores_router.get("", response_model=APIResponse[list[QualityScoreResponse]])
def list_scores(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.score:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    dimension: str | None = None,
):
    rows = QualityScoreService(db).list_scores(ctx, company_id, dimension)
    return APIResponse(
        message="Quality scores retrieved",
        data=[QualityScoreResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@scores_router.post("", response_model=APIResponse[QualityScoreResponse])
def create_score(
    body: QualityScoreCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.score:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityScoreService(db).create_score(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Quality score created", data=QualityScoreResponse.model_validate(row))


@scores_router.get("/{score_id}", response_model=APIResponse[QualityScoreResponse])
def get_score(
    score_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.score:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityScoreService(db).get_score(ctx, score_id)
    return APIResponse(message="Quality score retrieved", data=QualityScoreResponse.model_validate(row))


@scores_router.patch("/{score_id}", response_model=APIResponse[QualityScoreResponse])
def update_score(
    score_id: UUID,
    body: QualityScoreUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.score:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityScoreService(db).update_score(ctx, score_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Quality score updated", data=QualityScoreResponse.model_validate(row))


@scores_router.post("/{score_id}/publish", response_model=APIResponse[QualityScoreResponse])
def publish_score(
    score_id: UUID,
    body: QualityScorePublishRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.score:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = QualityScoreService(db).compute_and_publish(ctx, score_id, body.model_dump())
    db.commit()
    return APIResponse(message="Quality score published", data=QualityScoreResponse.model_validate(row))


@reports_router.get("/inspection-summary", response_model=APIResponse[ReportSummaryResponse])
def inspection_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).inspection_summary(ctx, company_id)
    return APIResponse(message="Inspection summary", data=ReportSummaryResponse(**data))


@reports_router.get("/defect-summary", response_model=APIResponse[ReportSummaryResponse])
def defect_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).defect_summary(ctx, company_id)
    return APIResponse(message="Defect summary", data=ReportSummaryResponse(**data))


@reports_router.get("/ncr-summary", response_model=APIResponse[ReportSummaryResponse])
def ncr_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).ncr_summary(ctx, company_id)
    return APIResponse(message="NCR summary", data=ReportSummaryResponse(**data))


@reports_router.get("/capa-summary", response_model=APIResponse[ReportSummaryResponse])
def capa_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).capa_summary(ctx, company_id)
    return APIResponse(message="CAPA summary", data=ReportSummaryResponse(**data))


@reports_router.get("/kpi-dashboard", response_model=APIResponse[ReportSummaryResponse])
def kpi_dashboard(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).kpi_dashboard(ctx, company_id)
    return APIResponse(message="KPI dashboard", data=ReportSummaryResponse(**data))


@reports_router.get("/ppap-status-summary", response_model=APIResponse[ReportSummaryResponse])
def ppap_status_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).ppap_status_summary(ctx, company_id)
    return APIResponse(message="PPAP status summary", data=ReportSummaryResponse(**data))


@reports_router.get("/scar-summary", response_model=APIResponse[ReportSummaryResponse])
def scar_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).scar_summary(ctx, company_id)
    return APIResponse(message="SCAR summary", data=ReportSummaryResponse(**data))


@reports_router.get("/spc-capability-summary", response_model=APIResponse[ReportSummaryResponse])
def spc_capability_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).spc_capability_summary(ctx, company_id)
    return APIResponse(message="SPC capability summary", data=ReportSummaryResponse(**data))


@reports_router.get("/warranty-trend", response_model=APIResponse[ReportSummaryResponse])
def warranty_trend(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    data = QualityReportService(db).warranty_trend(ctx, company_id)
    return APIResponse(message="Warranty trend", data=ReportSummaryResponse(**data))


@pfmeas_router.get("", response_model=APIResponse[list[PfmeaResponse]])
def list_pfmeas(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.pfmea:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = PfmeaService(db).list_pfmeas(ctx, company_id)
    return APIResponse(
        message="PFMEAs retrieved",
        data=[PfmeaResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@pfmeas_router.post("", response_model=APIResponse[PfmeaResponse])
def create_pfmea(
    body: PfmeaCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.pfmea:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PfmeaService(db).create_pfmea(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="PFMEA created", data=PfmeaResponse.model_validate(row))


@pfmeas_router.get("/{pfmea_id}", response_model=APIResponse[PfmeaResponse])
def get_pfmea(
    pfmea_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.pfmea:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PfmeaService(db).get_pfmea(ctx, pfmea_id)
    return APIResponse(message="PFMEA retrieved", data=PfmeaResponse.model_validate(row))


@pfmeas_router.patch("/{pfmea_id}", response_model=APIResponse[PfmeaResponse])
def update_pfmea(
    pfmea_id: UUID,
    body: PfmeaUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.pfmea:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PfmeaService(db).update_pfmea(ctx, pfmea_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="PFMEA updated", data=PfmeaResponse.model_validate(row))


@ppaps_router.get("", response_model=APIResponse[list[PpapResponse]])
def list_ppaps(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = PpapService(db).list_ppaps(ctx, company_id)
    return APIResponse(
        message="PPAPs retrieved",
        data=[PpapResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@ppaps_router.post("", response_model=APIResponse[PpapResponse])
def create_ppap(
    body: PpapCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).create_ppap(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="PPAP created", data=PpapResponse.model_validate(row))


@ppaps_router.get("/{ppap_id}", response_model=APIResponse[PpapResponse])
def get_ppap(
    ppap_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).get_ppap(ctx, ppap_id)
    return APIResponse(message="PPAP retrieved", data=PpapResponse.model_validate(row))


@ppaps_router.patch("/{ppap_id}", response_model=APIResponse[PpapResponse])
def update_ppap(
    ppap_id: UUID,
    body: PpapUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).update_ppap(ctx, ppap_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="PPAP updated", data=PpapResponse.model_validate(row))


@ppaps_router.post("/{ppap_id}/submit", response_model=APIResponse[PpapResponse])
def submit_ppap(
    ppap_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).submit(ctx, ppap_id)
    db.commit()
    return APIResponse(message="PPAP submitted", data=PpapResponse.model_validate(row))


@ppaps_router.post("/{ppap_id}/approve", response_model=APIResponse[PpapResponse])
def approve_ppap(
    ppap_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).approve(ctx, ppap_id)
    db.commit()
    return APIResponse(message="PPAP approved", data=PpapResponse.model_validate(row))


@ppaps_router.post("/{ppap_id}/reject", response_model=APIResponse[PpapResponse])
def reject_ppap(
    ppap_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).reject(ctx, ppap_id)
    db.commit()
    return APIResponse(message="PPAP rejected", data=PpapResponse.model_validate(row))


@ppaps_router.post("/{ppap_id}/interim", response_model=APIResponse[PpapResponse])
def interim_ppap(
    ppap_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.ppap:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = PpapService(db).interim(ctx, ppap_id)
    db.commit()
    return APIResponse(message="PPAP granted interim approval", data=PpapResponse.model_validate(row))


@spc_readings_router.get("", response_model=APIResponse[list[SpcReadingResponse]])
def list_spc_readings(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.spc_reading:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    characteristic_id: UUID | None = None,
):
    rows = SpcReadingService(db).list_readings(ctx, company_id, characteristic_id)
    return APIResponse(
        message="SPC readings retrieved",
        data=[SpcReadingResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@spc_readings_router.post("", response_model=APIResponse[SpcReadingResponse])
def create_spc_reading(
    body: SpcReadingCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.spc_reading:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SpcReadingService(db).create_reading(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="SPC reading created", data=SpcReadingResponse.model_validate(row))


@spc_readings_router.get("/capability", response_model=APIResponse[SpcCapabilityResponse])
def get_spc_capability(
    characteristic_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.spc_reading:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    cap = SpcReadingService(db).capability(ctx, characteristic_id, company_id)
    return APIResponse(
        message="SPC capability retrieved",
        data=SpcCapabilityResponse(
            characteristic_id=cap.characteristic_id,
            sample_count=cap.sample_count,
            mean=cap.mean,
            stdev=cap.stdev,
            lsl=cap.lsl,
            usl=cap.usl,
            target=cap.target,
            cp=cap.cp,
            cpk=cap.cpk,
        ),
    )


@spc_readings_router.get("/{reading_id}", response_model=APIResponse[SpcReadingResponse])
def get_spc_reading(
    reading_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.spc_reading:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = SpcReadingService(db)
    row = service.get_reading(ctx, reading_id)
    cap = service.capability(ctx, row.characteristic_id, row.company_id)
    data = SpcReadingResponse.model_validate(row).model_copy(
        update={
            "capability": SpcCapabilityResponse(
                characteristic_id=cap.characteristic_id,
                sample_count=cap.sample_count,
                mean=cap.mean,
                stdev=cap.stdev,
                lsl=cap.lsl,
                usl=cap.usl,
                target=cap.target,
                cp=cap.cp,
                cpk=cap.cpk,
            )
        }
    )
    return APIResponse(message="SPC reading retrieved", data=data)


@scars_router.get("", response_model=APIResponse[list[ScarResponse]])
def list_scars(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    vendor_id: UUID | None = None,
):
    rows = ScarService(db).list_scars(ctx, company_id, vendor_id)
    return APIResponse(
        message="SCARs retrieved",
        data=[ScarResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@scars_router.post("", response_model=APIResponse[ScarResponse])
def create_scar(
    body: ScarCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).create_scar(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="SCAR created", data=ScarResponse.model_validate(row))


@scars_router.get("/{scar_id}", response_model=APIResponse[ScarResponse])
def get_scar(
    scar_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).get_scar(ctx, scar_id)
    return APIResponse(message="SCAR retrieved", data=ScarResponse.model_validate(row))


@scars_router.patch("/{scar_id}", response_model=APIResponse[ScarResponse])
def update_scar(
    scar_id: UUID,
    body: ScarUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).update_scar(ctx, scar_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="SCAR updated", data=ScarResponse.model_validate(row))


@scars_router.post("/{scar_id}/issue", response_model=APIResponse[ScarResponse])
def issue_scar(
    scar_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:issue"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).issue(ctx, scar_id)
    db.commit()
    return APIResponse(message="SCAR issued", data=ScarResponse.model_validate(row))


@scars_router.post("/{scar_id}/record-response", response_model=APIResponse[ScarResponse])
def record_scar_response(
    scar_id: UUID,
    body: ScarRecordResponseRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).record_response(ctx, scar_id, body.supplier_response)
    db.commit()
    return APIResponse(message="Supplier response recorded", data=ScarResponse.model_validate(row))


@scars_router.post("/{scar_id}/verify", response_model=APIResponse[ScarResponse])
def verify_scar(
    scar_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:verify"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).verify(ctx, scar_id)
    db.commit()
    return APIResponse(message="SCAR verified", data=ScarResponse.model_validate(row))


@scars_router.post("/{scar_id}/close", response_model=APIResponse[ScarResponse])
def close_scar(
    scar_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.scar:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ScarService(db).close(ctx, scar_id)
    db.commit()
    return APIResponse(message="SCAR closed", data=ScarResponse.model_validate(row))


@vin_traces_router.get("", response_model=APIResponse[list[VinTraceResponse]])
def list_vin_traces(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.vin_trace:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    product_id: UUID | None = None,
):
    rows = VinTraceService(db).list_traces(ctx, company_id, product_id)
    return APIResponse(
        message="VIN traces retrieved",
        data=[VinTraceResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@vin_traces_router.post("", response_model=APIResponse[VinTraceResponse])
def create_vin_trace(
    body: VinTraceCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.vin_trace:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = body.model_dump()
    components = data.pop("components", [])
    row = VinTraceService(db).create_trace(ctx, components=components, **data)
    db.commit()
    return APIResponse(message="VIN trace created", data=VinTraceResponse.model_validate(row))


@vin_traces_router.get("/{trace_id}", response_model=APIResponse[VinTraceResponse])
def get_vin_trace(
    trace_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.vin_trace:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = VinTraceService(db).get_trace(ctx, trace_id)
    return APIResponse(message="VIN trace retrieved", data=VinTraceResponse.model_validate(row))


@vin_traces_router.patch("/{trace_id}", response_model=APIResponse[VinTraceResponse])
def update_vin_trace(
    trace_id: UUID,
    body: VinTraceUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.vin_trace:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = VinTraceService(db).update_trace(ctx, trace_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="VIN trace updated", data=VinTraceResponse.model_validate(row))


@warranty_claims_router.get("", response_model=APIResponse[list[WarrantyClaimResponse]])
def list_warranty_claims(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    vin_trace_id: UUID | None = None,
):
    rows = WarrantyClaimService(db).list_claims(ctx, company_id, vin_trace_id)
    return APIResponse(
        message="Warranty claims retrieved",
        data=[WarrantyClaimResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@warranty_claims_router.post("", response_model=APIResponse[WarrantyClaimResponse])
def create_warranty_claim(
    body: WarrantyClaimCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).create_claim(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Warranty claim created", data=WarrantyClaimResponse.model_validate(row))


@warranty_claims_router.get("/{claim_id}", response_model=APIResponse[WarrantyClaimResponse])
def get_warranty_claim(
    claim_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).get_claim(ctx, claim_id)
    return APIResponse(message="Warranty claim retrieved", data=WarrantyClaimResponse.model_validate(row))


@warranty_claims_router.patch("/{claim_id}", response_model=APIResponse[WarrantyClaimResponse])
def update_warranty_claim(
    claim_id: UUID,
    body: WarrantyClaimUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).update_claim(ctx, claim_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Warranty claim updated", data=WarrantyClaimResponse.model_validate(row))


@warranty_claims_router.post("/{claim_id}/investigate", response_model=APIResponse[WarrantyClaimResponse])
def investigate_warranty_claim(
    claim_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).investigate(ctx, claim_id)
    db.commit()
    return APIResponse(message="Warranty claim investigation started", data=WarrantyClaimResponse.model_validate(row))


@warranty_claims_router.post("/{claim_id}/link-capa", response_model=APIResponse[WarrantyClaimResponse])
def link_warranty_claim_capa(
    claim_id: UUID,
    body: WarrantyLinkCapaRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).link_capa(ctx, claim_id, body.capa_id)
    db.commit()
    return APIResponse(message="CAPA linked to warranty claim", data=WarrantyClaimResponse.model_validate(row))


@warranty_claims_router.post("/{claim_id}/close", response_model=APIResponse[WarrantyClaimResponse])
def close_warranty_claim(
    claim_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.warranty_claim:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = WarrantyClaimService(db).close(ctx, claim_id)
    db.commit()
    return APIResponse(message="Warranty claim closed", data=WarrantyClaimResponse.model_validate(row))


@recalls_router.get("", response_model=APIResponse[list[RecallResponse]])
def list_recalls(
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    product_id: UUID | None = None,
):
    rows = RecallService(db).list_recalls(ctx, company_id, product_id)
    return APIResponse(
        message="Recalls retrieved",
        data=[RecallResponse.model_validate(r) for r in paginate(rows, pagination)],
    )


@recalls_router.post("", response_model=APIResponse[RecallResponse])
def create_recall(
    body: RecallCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = RecallService(db).create_recall(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Recall created", data=RecallResponse.model_validate(row))


@recalls_router.get("/{recall_id}", response_model=APIResponse[RecallResponse])
def get_recall(
    recall_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = RecallService(db).get_recall(ctx, recall_id)
    return APIResponse(message="Recall retrieved", data=RecallResponse.model_validate(row))


@recalls_router.patch("/{recall_id}", response_model=APIResponse[RecallResponse])
def update_recall(
    recall_id: UUID,
    body: RecallUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = RecallService(db).update_recall(ctx, recall_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Recall updated", data=RecallResponse.model_validate(row))


@recalls_router.post("/{recall_id}/announce", response_model=APIResponse[RecallResponse])
def announce_recall(
    recall_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = RecallService(db).announce(ctx, recall_id)
    db.commit()
    return APIResponse(message="Recall announced", data=RecallResponse.model_validate(row))


@recalls_router.post("/{recall_id}/close", response_model=APIResponse[RecallResponse])
def close_recall(
    recall_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("quality.recall:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = RecallService(db).close(ctx, recall_id)
    db.commit()
    return APIResponse(message="Recall closed", data=RecallResponse.model_validate(row))

