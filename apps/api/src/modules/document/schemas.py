"""Document Pydantic schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FolderCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class FolderUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class FolderResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class DocumentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentVersionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentVersionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentVersionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentMetadataCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentMetadataUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentMetadataResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentTagCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentTagUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentTagResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentTagMapCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentTagMapUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentTagMapResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentPermissionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentPermissionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentPermissionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentShareCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentShareUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentShareResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentCommentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentCommentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentCommentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentApprovalCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class DocumentApprovalUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentApprovalResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentWorkflowCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentWorkflowUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentWorkflowResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentCheckoutCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class DocumentCheckoutUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentCheckoutResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAuditResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DocumentAttachmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAttachmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAttachmentResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class TemplateCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TemplateUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TemplateResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class TemplateFieldCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TemplateFieldUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TemplateFieldResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class RetentionPolicyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RetentionPolicyUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RetentionPolicyResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ArchiveCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ArchiveUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ArchiveResponse(OrmModel):
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
