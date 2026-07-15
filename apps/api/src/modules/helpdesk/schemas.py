"""Helpdesk Pydantic schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TicketCategoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketCategoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketCategoryResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketPriorityCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketPriorityUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketPriorityResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketAssignmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketAssignmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketAssignmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketStatusHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketStatusHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketStatusHistoryResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketCommentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketCommentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketCommentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketAttachmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketAttachmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketAttachmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketActivityCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketActivityUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketActivityResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketSlaCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketSlaUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketSlaResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketEscalationCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class TicketEscalationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketEscalationResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class KnowledgeBaseCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class KnowledgeBaseUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class KnowledgeBaseResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class KnowledgeArticleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class KnowledgeArticleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class KnowledgeArticleResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class ResolutionCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class ResolutionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class ResolutionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class CustomerFeedbackCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class CustomerFeedbackUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class CustomerFeedbackResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class SupportTeamCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class SupportTeamUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportTeamResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class SupportShiftCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class SupportShiftUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportShiftResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class SupportScheduleCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None


class SupportScheduleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class SupportScheduleResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketNotificationResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int


class TicketDashboardCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None


class TicketDashboardUpdate(BaseModel):
    status: str | None = None
    version: int | None = None


class TicketDashboardResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int
