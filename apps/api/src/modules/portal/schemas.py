"""Customer Portal Pydantic schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PortalAccountCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalAccountUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalAccountResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class CustomerProfileCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class CustomerProfileUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class CustomerProfileResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class PortalSessionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalSessionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalSessionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DashboardCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DashboardWidgetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardWidgetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardWidgetResponse(OrmModel):
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

class MessageThreadCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageThreadUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageThreadResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class MessageCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class OrderViewCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OrderViewUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OrderViewResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class InvoiceViewCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class InvoiceViewUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class InvoiceViewResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentAccessCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAccessUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAccessResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class SupportTicketCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SupportTicketUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SupportTicketResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ServiceRequestCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ServiceRequestUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ServiceRequestResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DownloadHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DownloadHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DownloadHistoryResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class SavedReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SavedReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SavedReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class SavedSearchCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SavedSearchUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SavedSearchResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class PreferenceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PreferenceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PreferenceResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DeviceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DeviceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DeviceResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class LoginAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class LoginAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class LoginAuditResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class PortalReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PortalReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PortalReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int
