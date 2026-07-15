"""GRC Pydantic schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PolicyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class PolicyVersionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyVersionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyVersionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class PolicyAcknowledgementCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PolicyAcknowledgementUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PolicyAcknowledgementResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ControlCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ControlUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ControlResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ControlTestCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ControlTestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ControlTestResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class RiskCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RiskCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskCategoryResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class RiskRegisterCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskRegisterUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskRegisterResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class RiskAssessmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskAssessmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskAssessmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class RiskTreatmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class RiskTreatmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RiskTreatmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ComplianceFrameworkCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ComplianceFrameworkUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceFrameworkResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ComplianceRequirementCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ComplianceRequirementUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceRequirementResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ComplianceAssessmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ComplianceAssessmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ComplianceAssessmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class AuditPlanCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AuditPlanUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditPlanResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class AuditCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class AuditFindingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class AuditFindingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AuditFindingResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class CorrectiveActionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class CorrectiveActionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CorrectiveActionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ExceptionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ExceptionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ExceptionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class IncidentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class IncidentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class IncidentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class NotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class NotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class NotificationResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int
