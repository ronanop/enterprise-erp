"""GRC API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.grc.schemas import (
    AuditCreate,
    AuditFindingCreate,
    AuditFindingResponse,
    AuditFindingUpdate,
    AuditPlanCreate,
    AuditPlanResponse,
    AuditPlanUpdate,
    AuditResponse,
    AuditUpdate,
    ComplianceAssessmentCreate,
    ComplianceAssessmentResponse,
    ComplianceAssessmentUpdate,
    ComplianceFrameworkCreate,
    ComplianceFrameworkResponse,
    ComplianceFrameworkUpdate,
    ComplianceRequirementCreate,
    ComplianceRequirementResponse,
    ComplianceRequirementUpdate,
    ControlCreate,
    ControlResponse,
    ControlTestCreate,
    ControlTestResponse,
    ControlTestUpdate,
    ControlUpdate,
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionUpdate,
    ExceptionCreate,
    ExceptionResponse,
    ExceptionUpdate,
    IncidentCreate,
    IncidentResponse,
    IncidentUpdate,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    PolicyAcknowledgementCreate,
    PolicyAcknowledgementResponse,
    PolicyAcknowledgementUpdate,
    PolicyCreate,
    PolicyResponse,
    PolicyUpdate,
    PolicyVersionCreate,
    PolicyVersionResponse,
    PolicyVersionUpdate,
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    RiskAssessmentCreate,
    RiskAssessmentResponse,
    RiskAssessmentUpdate,
    RiskCategoryCreate,
    RiskCategoryResponse,
    RiskCategoryUpdate,
    RiskRegisterCreate,
    RiskRegisterResponse,
    RiskRegisterUpdate,
    RiskTreatmentCreate,
    RiskTreatmentResponse,
    RiskTreatmentUpdate,
)
from modules.grc.service import (
    AuditFindingService,
    AuditPlanService,
    ComplianceAssessmentService,
    ComplianceFrameworkService,
    ComplianceRequirementService,
    ControlService,
    ControlTestService,
    CorrectiveActionService,
    ExceptionService,
    GrcAuditService,
    GrcReportService,
    IncidentService,
    NotificationService,
    PolicyAcknowledgementService,
    PolicyService,
    PolicyVersionService,
    RiskAssessmentService,
    RiskCategoryService,
    RiskRegisterService,
    RiskTreatmentService,
)
from shared.schemas import APIResponse

policies_router = APIRouter(prefix="/policies", tags=["GRC — Policy"])

@policies_router.get("", response_model=APIResponse[list[PolicyResponse]])
def list_policies(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PolicyService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@policies_router.get("/{row_id}", response_model=APIResponse[PolicyResponse])
def get_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PolicyService(db).get(ctx, row_id))

@policies_router.post("", response_model=APIResponse[PolicyResponse])
def create_policies(
    body: PolicyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PolicyService(db).create(ctx, **body.model_dump(exclude_none=True)))

@policies_router.patch("/{row_id}", response_model=APIResponse[PolicyResponse])
def update_policies(
    row_id: UUID,
    body: PolicyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PolicyService(db).update(ctx, row_id, **extract_update_fields(body)))

@policies_router.post("/{row_id}/submit", response_model=APIResponse[PolicyResponse])
def submit_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=PolicyService(db).submit(ctx, row_id))

@policies_router.post("/{row_id}/approve", response_model=APIResponse[PolicyResponse])
def approve_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=PolicyService(db).approve(ctx, row_id))

@policies_router.post("/{row_id}/publish", response_model=APIResponse[PolicyResponse])
def publish_policies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=PolicyService(db).publish(ctx, row_id))

policy_versions_router = APIRouter(prefix="/policy-versions", tags=["GRC — PolicyVersion"])

@policy_versions_router.get("", response_model=APIResponse[list[PolicyVersionResponse]])
def list_policy_versions(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy_version:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PolicyVersionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@policy_versions_router.get("/{row_id}", response_model=APIResponse[PolicyVersionResponse])
def get_policy_versions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy_version:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PolicyVersionService(db).get(ctx, row_id))

@policy_versions_router.post("", response_model=APIResponse[PolicyVersionResponse])
def create_policy_versions(
    body: PolicyVersionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy_version:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PolicyVersionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@policy_versions_router.patch("/{row_id}", response_model=APIResponse[PolicyVersionResponse])
def update_policy_versions(
    row_id: UUID,
    body: PolicyVersionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.policy_version:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PolicyVersionService(db).update(ctx, row_id, **extract_update_fields(body)))

policy_acknowledgements_router = APIRouter(prefix="/policy-acknowledgements", tags=["GRC — PolicyAcknowledgement"])

@policy_acknowledgements_router.get("", response_model=APIResponse[list[PolicyAcknowledgementResponse]])
def list_policy_acknowledgements(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.acknowledgement:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PolicyAcknowledgementService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@policy_acknowledgements_router.get("/{row_id}", response_model=APIResponse[PolicyAcknowledgementResponse])
def get_policy_acknowledgements(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.acknowledgement:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PolicyAcknowledgementService(db).get(ctx, row_id))

@policy_acknowledgements_router.post("", response_model=APIResponse[PolicyAcknowledgementResponse])
def create_policy_acknowledgements(
    body: PolicyAcknowledgementCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.acknowledgement:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PolicyAcknowledgementService(db).create(ctx, **body.model_dump(exclude_none=True)))

@policy_acknowledgements_router.patch("/{row_id}", response_model=APIResponse[PolicyAcknowledgementResponse])
def update_policy_acknowledgements(
    row_id: UUID,
    body: PolicyAcknowledgementUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.acknowledgement:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PolicyAcknowledgementService(db).update(ctx, row_id, **extract_update_fields(body)))

controls_router = APIRouter(prefix="/controls", tags=["GRC — Control"])

@controls_router.get("", response_model=APIResponse[list[ControlResponse]])
def list_controls(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ControlService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@controls_router.get("/{row_id}", response_model=APIResponse[ControlResponse])
def get_controls(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ControlService(db).get(ctx, row_id))

@controls_router.post("", response_model=APIResponse[ControlResponse])
def create_controls(
    body: ControlCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ControlService(db).create(ctx, **body.model_dump(exclude_none=True)))

@controls_router.patch("/{row_id}", response_model=APIResponse[ControlResponse])
def update_controls(
    row_id: UUID,
    body: ControlUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ControlService(db).update(ctx, row_id, **extract_update_fields(body)))

control_tests_router = APIRouter(prefix="/control-tests", tags=["GRC — ControlTest"])

@control_tests_router.get("", response_model=APIResponse[list[ControlTestResponse]])
def list_control_tests(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control_test:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ControlTestService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@control_tests_router.get("/{row_id}", response_model=APIResponse[ControlTestResponse])
def get_control_tests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control_test:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ControlTestService(db).get(ctx, row_id))

@control_tests_router.post("", response_model=APIResponse[ControlTestResponse])
def create_control_tests(
    body: ControlTestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control_test:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ControlTestService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@control_tests_router.patch("/{row_id}", response_model=APIResponse[ControlTestResponse])
def update_control_tests(
    row_id: UUID,
    body: ControlTestUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.control_test:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ControlTestService(db).update(ctx, row_id, **extract_update_fields(body)))

risk_categories_router = APIRouter(prefix="/risk-categories", tags=["GRC — RiskCategory"])

@risk_categories_router.get("", response_model=APIResponse[list[RiskCategoryResponse]])
def list_risk_categories(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_category:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RiskCategoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@risk_categories_router.get("/{row_id}", response_model=APIResponse[RiskCategoryResponse])
def get_risk_categories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_category:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RiskCategoryService(db).get(ctx, row_id))

@risk_categories_router.post("", response_model=APIResponse[RiskCategoryResponse])
def create_risk_categories(
    body: RiskCategoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_category:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RiskCategoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@risk_categories_router.patch("/{row_id}", response_model=APIResponse[RiskCategoryResponse])
def update_risk_categories(
    row_id: UUID,
    body: RiskCategoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RiskCategoryService(db).update(ctx, row_id, **extract_update_fields(body)))

risk_registers_router = APIRouter(prefix="/risk-registers", tags=["GRC — RiskRegister"])

@risk_registers_router.get("", response_model=APIResponse[list[RiskRegisterResponse]])
def list_risk_registers(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RiskRegisterService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@risk_registers_router.get("/{row_id}", response_model=APIResponse[RiskRegisterResponse])
def get_risk_registers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RiskRegisterService(db).get(ctx, row_id))

@risk_registers_router.post("", response_model=APIResponse[RiskRegisterResponse])
def create_risk_registers(
    body: RiskRegisterCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RiskRegisterService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@risk_registers_router.patch("/{row_id}", response_model=APIResponse[RiskRegisterResponse])
def update_risk_registers(
    row_id: UUID,
    body: RiskRegisterUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RiskRegisterService(db).update(ctx, row_id, **extract_update_fields(body)))

@risk_registers_router.post("/{row_id}/submit", response_model=APIResponse[RiskRegisterResponse])
def submit_risk_registers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=RiskRegisterService(db).submit(ctx, row_id))

@risk_registers_router.post("/{row_id}/approve", response_model=APIResponse[RiskRegisterResponse])
def approve_risk_registers(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=RiskRegisterService(db).approve(ctx, row_id))

risk_assessments_router = APIRouter(prefix="/risk-assessments", tags=["GRC — RiskAssessment"])

@risk_assessments_router.get("", response_model=APIResponse[list[RiskAssessmentResponse]])
def list_risk_assessments(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_assessment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RiskAssessmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@risk_assessments_router.get("/{row_id}", response_model=APIResponse[RiskAssessmentResponse])
def get_risk_assessments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_assessment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RiskAssessmentService(db).get(ctx, row_id))

@risk_assessments_router.post("", response_model=APIResponse[RiskAssessmentResponse])
def create_risk_assessments(
    body: RiskAssessmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_assessment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RiskAssessmentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@risk_assessments_router.patch("/{row_id}", response_model=APIResponse[RiskAssessmentResponse])
def update_risk_assessments(
    row_id: UUID,
    body: RiskAssessmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_assessment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RiskAssessmentService(db).update(ctx, row_id, **extract_update_fields(body)))

risk_treatments_router = APIRouter(prefix="/risk-treatments", tags=["GRC — RiskTreatment"])

@risk_treatments_router.get("", response_model=APIResponse[list[RiskTreatmentResponse]])
def list_risk_treatments(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_treatment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RiskTreatmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@risk_treatments_router.get("/{row_id}", response_model=APIResponse[RiskTreatmentResponse])
def get_risk_treatments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_treatment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RiskTreatmentService(db).get(ctx, row_id))

@risk_treatments_router.post("", response_model=APIResponse[RiskTreatmentResponse])
def create_risk_treatments(
    body: RiskTreatmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_treatment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RiskTreatmentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@risk_treatments_router.patch("/{row_id}", response_model=APIResponse[RiskTreatmentResponse])
def update_risk_treatments(
    row_id: UUID,
    body: RiskTreatmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.risk_treatment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RiskTreatmentService(db).update(ctx, row_id, **extract_update_fields(body)))

compliance_frameworks_router = APIRouter(prefix="/compliance-frameworks", tags=["GRC — ComplianceFramework"])

@compliance_frameworks_router.get("", response_model=APIResponse[list[ComplianceFrameworkResponse]])
def list_compliance_frameworks(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_framework:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ComplianceFrameworkService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@compliance_frameworks_router.get("/{row_id}", response_model=APIResponse[ComplianceFrameworkResponse])
def get_compliance_frameworks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_framework:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ComplianceFrameworkService(db).get(ctx, row_id))

@compliance_frameworks_router.post("", response_model=APIResponse[ComplianceFrameworkResponse])
def create_compliance_frameworks(
    body: ComplianceFrameworkCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_framework:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ComplianceFrameworkService(db).create(ctx, **body.model_dump(exclude_none=True)))

@compliance_frameworks_router.patch("/{row_id}", response_model=APIResponse[ComplianceFrameworkResponse])
def update_compliance_frameworks(
    row_id: UUID,
    body: ComplianceFrameworkUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_framework:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ComplianceFrameworkService(db).update(ctx, row_id, **extract_update_fields(body)))

compliance_requirements_router = APIRouter(prefix="/compliance-requirements", tags=["GRC — ComplianceRequirement"])

@compliance_requirements_router.get("", response_model=APIResponse[list[ComplianceRequirementResponse]])
def list_compliance_requirements(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_requirement:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ComplianceRequirementService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@compliance_requirements_router.get("/{row_id}", response_model=APIResponse[ComplianceRequirementResponse])
def get_compliance_requirements(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_requirement:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ComplianceRequirementService(db).get(ctx, row_id))

@compliance_requirements_router.post("", response_model=APIResponse[ComplianceRequirementResponse])
def create_compliance_requirements(
    body: ComplianceRequirementCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_requirement:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ComplianceRequirementService(db).create(ctx, **body.model_dump(exclude_none=True)))

@compliance_requirements_router.patch("/{row_id}", response_model=APIResponse[ComplianceRequirementResponse])
def update_compliance_requirements(
    row_id: UUID,
    body: ComplianceRequirementUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_requirement:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ComplianceRequirementService(db).update(ctx, row_id, **extract_update_fields(body)))

compliance_assessments_router = APIRouter(prefix="/compliance-assessments", tags=["GRC — ComplianceAssessment"])

@compliance_assessments_router.get("", response_model=APIResponse[list[ComplianceAssessmentResponse]])
def list_compliance_assessments(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_assessment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ComplianceAssessmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@compliance_assessments_router.get("/{row_id}", response_model=APIResponse[ComplianceAssessmentResponse])
def get_compliance_assessments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_assessment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ComplianceAssessmentService(db).get(ctx, row_id))

@compliance_assessments_router.post("", response_model=APIResponse[ComplianceAssessmentResponse])
def create_compliance_assessments(
    body: ComplianceAssessmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_assessment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ComplianceAssessmentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@compliance_assessments_router.patch("/{row_id}", response_model=APIResponse[ComplianceAssessmentResponse])
def update_compliance_assessments(
    row_id: UUID,
    body: ComplianceAssessmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.compliance_assessment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ComplianceAssessmentService(db).update(ctx, row_id, **extract_update_fields(body)))

audit_plans_router = APIRouter(prefix="/audit-plans", tags=["GRC — AuditPlan"])

@audit_plans_router.get("", response_model=APIResponse[list[AuditPlanResponse]])
def list_audit_plans(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = AuditPlanService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@audit_plans_router.get("/{row_id}", response_model=APIResponse[AuditPlanResponse])
def get_audit_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit_plan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AuditPlanService(db).get(ctx, row_id))

@audit_plans_router.post("", response_model=APIResponse[AuditPlanResponse])
def create_audit_plans(
    body: AuditPlanCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit_plan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AuditPlanService(db).create(ctx, **body.model_dump(exclude_none=True)))

@audit_plans_router.patch("/{row_id}", response_model=APIResponse[AuditPlanResponse])
def update_audit_plans(
    row_id: UUID,
    body: AuditPlanUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit_plan:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AuditPlanService(db).update(ctx, row_id, **extract_update_fields(body)))

audits_router = APIRouter(prefix="/audits", tags=["GRC — Audit"])

@audits_router.get("", response_model=APIResponse[list[AuditResponse]])
def list_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = GrcAuditService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@audits_router.get("/{row_id}", response_model=APIResponse[AuditResponse])
def get_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=GrcAuditService(db).get(ctx, row_id))

@audits_router.post("", response_model=APIResponse[AuditResponse])
def create_audits(
    body: AuditCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=GrcAuditService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@audits_router.patch("/{row_id}", response_model=APIResponse[AuditResponse])
def update_audits(
    row_id: UUID,
    body: AuditUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=GrcAuditService(db).update(ctx, row_id, **extract_update_fields(body)))

@audits_router.post("/{row_id}/submit", response_model=APIResponse[AuditResponse])
def submit_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=GrcAuditService(db).submit(ctx, row_id))

@audits_router.post("/{row_id}/approve", response_model=APIResponse[AuditResponse])
def approve_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.audit:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=GrcAuditService(db).approve(ctx, row_id))

audit_findings_router = APIRouter(prefix="/audit-findings", tags=["GRC — AuditFinding"])

@audit_findings_router.get("", response_model=APIResponse[list[AuditFindingResponse]])
def list_audit_findings(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.finding:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = AuditFindingService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@audit_findings_router.get("/{row_id}", response_model=APIResponse[AuditFindingResponse])
def get_audit_findings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.finding:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AuditFindingService(db).get(ctx, row_id))

@audit_findings_router.post("", response_model=APIResponse[AuditFindingResponse])
def create_audit_findings(
    body: AuditFindingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.finding:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AuditFindingService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@audit_findings_router.patch("/{row_id}", response_model=APIResponse[AuditFindingResponse])
def update_audit_findings(
    row_id: UUID,
    body: AuditFindingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.finding:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AuditFindingService(db).update(ctx, row_id, **extract_update_fields(body)))

corrective_actions_router = APIRouter(prefix="/corrective-actions", tags=["GRC — CorrectiveAction"])

@corrective_actions_router.get("", response_model=APIResponse[list[CorrectiveActionResponse]])
def list_corrective_actions(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CorrectiveActionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@corrective_actions_router.get("/{row_id}", response_model=APIResponse[CorrectiveActionResponse])
def get_corrective_actions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CorrectiveActionService(db).get(ctx, row_id))

@corrective_actions_router.post("", response_model=APIResponse[CorrectiveActionResponse])
def create_corrective_actions(
    body: CorrectiveActionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CorrectiveActionService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@corrective_actions_router.patch("/{row_id}", response_model=APIResponse[CorrectiveActionResponse])
def update_corrective_actions(
    row_id: UUID,
    body: CorrectiveActionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CorrectiveActionService(db).update(ctx, row_id, **extract_update_fields(body)))

@corrective_actions_router.post("/{row_id}/submit", response_model=APIResponse[CorrectiveActionResponse])
def submit_corrective_actions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=CorrectiveActionService(db).submit(ctx, row_id))

@corrective_actions_router.post("/{row_id}/approve", response_model=APIResponse[CorrectiveActionResponse])
def approve_corrective_actions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=CorrectiveActionService(db).approve(ctx, row_id))

@corrective_actions_router.post("/{row_id}/complete", response_model=APIResponse[CorrectiveActionResponse])
def complete_corrective_actions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.corrective_action:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=CorrectiveActionService(db).complete(ctx, row_id))

exceptions_router = APIRouter(prefix="/exceptions", tags=["GRC — Exception"])

@exceptions_router.get("", response_model=APIResponse[list[ExceptionResponse]])
def list_exceptions(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.exception:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ExceptionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@exceptions_router.get("/{row_id}", response_model=APIResponse[ExceptionResponse])
def get_exceptions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.exception:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ExceptionService(db).get(ctx, row_id))

@exceptions_router.post("", response_model=APIResponse[ExceptionResponse])
def create_exceptions(
    body: ExceptionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.exception:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ExceptionService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@exceptions_router.patch("/{row_id}", response_model=APIResponse[ExceptionResponse])
def update_exceptions(
    row_id: UUID,
    body: ExceptionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.exception:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ExceptionService(db).update(ctx, row_id, **extract_update_fields(body)))

@exceptions_router.post("/{row_id}/approve", response_model=APIResponse[ExceptionResponse])
def approve_exceptions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.exception:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ExceptionService(db).approve(ctx, row_id))

incidents_router = APIRouter(prefix="/incidents", tags=["GRC — Incident"])

@incidents_router.get("", response_model=APIResponse[list[IncidentResponse]])
def list_incidents(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = IncidentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@incidents_router.get("/{row_id}", response_model=APIResponse[IncidentResponse])
def get_incidents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=IncidentService(db).get(ctx, row_id))

@incidents_router.post("", response_model=APIResponse[IncidentResponse])
def create_incidents(
    body: IncidentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=IncidentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@incidents_router.patch("/{row_id}", response_model=APIResponse[IncidentResponse])
def update_incidents(
    row_id: UUID,
    body: IncidentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=IncidentService(db).update(ctx, row_id, **extract_update_fields(body)))

@incidents_router.post("/{row_id}/submit", response_model=APIResponse[IncidentResponse])
def submit_incidents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=IncidentService(db).submit(ctx, row_id))

@incidents_router.post("/{row_id}/review", response_model=APIResponse[IncidentResponse])
def review_incidents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:review"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="review", data=IncidentService(db).review(ctx, row_id))

@incidents_router.post("/{row_id}/close", response_model=APIResponse[IncidentResponse])
def close_incidents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.incident:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="close", data=IncidentService(db).close(ctx, row_id))

notifications_router = APIRouter(prefix="/notifications", tags=["GRC — Notification"])

@notifications_router.get("", response_model=APIResponse[list[NotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@notifications_router.get("/{row_id}", response_model=APIResponse[NotificationResponse])
def get_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@notifications_router.post("", response_model=APIResponse[NotificationResponse])
def create_notifications(
    body: NotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@notifications_router.patch("/{row_id}", response_model=APIResponse[NotificationResponse])
def update_notifications(
    row_id: UUID,
    body: NotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

reports_router = APIRouter(prefix="/reports", tags=["GRC — Report"])

@reports_router.get("", response_model=APIResponse[list[ReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("grc.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = GrcReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=GrcReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ReportResponse])
def create_reports(
    body: ReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=GrcReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ReportResponse])
def update_reports(
    row_id: UUID,
    body: ReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("grc.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=GrcReportService(db).update(ctx, row_id, **extract_update_fields(body)))

