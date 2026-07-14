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
