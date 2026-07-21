"""Document Pydantic schemas."""

from datetime import date, datetime
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
    folder_code: str
    folder_name: str
    parent_folder_id: UUID | None
    folder_type: str
    department_id: UUID | None
    owner_employee_id: UUID | None
    path_label: str | None
    status: str
    company_id: UUID
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
    document_number: str
    folder_id: UUID | None
    title: str
    classification_level: str
    document_category: str | None
    owner_employee_id: UUID
    customer_id: UUID | None
    department_id: UUID | None
    template_id: UUID | None
    retention_policy_id: UUID | None
    workflow_config_id: UUID | None
    current_version_no: int
    mime_type: str | None
    file_extension: str | None
    storage_uri: str | None
    content_hash: str | None
    file_size_bytes: int | None
    helpdesk_ticket_id: UUID | None
    service_request_id: UUID | None
    project_id: UUID | None
    asset_id: UUID | None
    crm_opportunity_id: UUID | None
    inventory_ref_id: UUID | None
    production_order_id: UUID | None
    quality_ref_id: UUID | None
    finance_journal_id: UUID | None
    published_at: datetime | None
    expires_at: date | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class DocumentVersionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentVersionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentVersionResponse(OrmModel):
    id: UUID
    document_id: UUID
    version_no: int
    storage_uri: str | None
    content_hash: str | None
    file_size_bytes: int | None
    change_summary: str | None
    created_by_employee_id: UUID | None
    is_current: bool
    status: str
    company_id: UUID
    version: int

class DocumentMetadataCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentMetadataUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentMetadataResponse(OrmModel):
    id: UUID
    document_id: UUID
    meta_key: str
    meta_value: str | None
    value_type: str
    status: str
    company_id: UUID
    version: int

class DocumentTagCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentTagUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentTagResponse(OrmModel):
    id: UUID
    tag_code: str
    tag_name: str
    tag_group: str | None
    status: str
    company_id: UUID
    version: int

class DocumentTagMapCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentTagMapUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentTagMapResponse(OrmModel):
    id: UUID
    document_id: UUID
    tag_id: UUID
    tagged_by_employee_id: UUID | None
    tagged_at: datetime | None
    status: str
    company_id: UUID
    version: int

class DocumentPermissionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentPermissionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentPermissionResponse(OrmModel):
    id: UUID
    document_id: UUID | None
    folder_id: UUID | None
    grantee_type: str
    grantee_employee_id: UUID | None
    grantee_role_code: str | None
    grantee_department_id: UUID | None
    permission_level: str
    status: str
    company_id: UUID
    version: int

class DocumentShareCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentShareUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentShareResponse(OrmModel):
    id: UUID
    document_number: str | None
    document_id: UUID
    shared_with_employee_id: UUID | None
    shared_with_customer_id: UUID | None
    share_token_hash: str | None
    expires_at: datetime | None
    permission_level: str
    status: str
    company_id: UUID
    version: int

class DocumentCommentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentCommentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentCommentResponse(OrmModel):
    id: UUID
    document_id: UUID
    version_no: int | None
    author_employee_id: UUID
    body: str
    is_internal: bool
    commented_at: datetime | None
    status: str
    company_id: UUID
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
    document_number: str
    document_id: UUID
    approval_type: str
    requested_by_employee_id: UUID
    approver_employee_id: UUID | None
    decision: str
    decided_at: datetime | None
    comments: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class DocumentWorkflowCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentWorkflowUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentWorkflowResponse(OrmModel):
    id: UUID
    workflow_code: str
    workflow_name: str
    applies_to_category: str | None
    foundation_workflow_code: str
    is_default: bool
    status: str
    company_id: UUID
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
    document_number: str
    document_id: UUID
    checked_out_by_employee_id: UUID
    checked_out_at: datetime | None
    due_back_at: datetime | None
    checked_in_at: datetime | None
    lock_reason: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class DocumentAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAuditResponse(OrmModel):
    id: UUID
    document_id: UUID
    event_type: str
    actor_employee_id: UUID | None
    payload_json: dict | None
    occurred_at: datetime | None
    status: str
    company_id: UUID
    version: int

class DocumentAttachmentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DocumentAttachmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DocumentAttachmentResponse(OrmModel):
    id: UUID
    document_id: UUID
    file_name: str
    mime_type: str | None
    storage_uri: str | None
    content_hash: str | None
    file_size_bytes: int | None
    uploaded_by_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class TemplateCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TemplateUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TemplateResponse(OrmModel):
    id: UUID
    template_code: str
    template_name: str
    description: str | None
    category: str | None
    storage_uri: str | None
    owner_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class TemplateFieldCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TemplateFieldUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TemplateFieldResponse(OrmModel):
    id: UUID
    template_id: UUID
    field_code: str
    field_label: str
    field_type: str
    is_required: bool
    default_value: str | None
    sequence_no: int
    status: str
    company_id: UUID
    version: int

class RetentionPolicyCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RetentionPolicyUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RetentionPolicyResponse(OrmModel):
    id: UUID
    policy_code: str
    policy_name: str
    retention_days: int
    action_on_expiry: str
    applies_to_category: str | None
    applies_to_classification: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
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
    document_number: str
    document_id: UUID
    retention_policy_id: UUID | None
    archived_by_employee_id: UUID
    archived_at: datetime | None
    archive_location_uri: str | None
    reason: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class NotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class NotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class NotificationResponse(OrmModel):
    id: UUID
    document_id: UUID | None
    notification_type: str
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    payload_json: dict | None
    sent_at: datetime | None
    delivery_status: str
    status: str
    company_id: UUID
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    report_code: str
    report_type: str
    period_start: date | None
    period_end: date | None
    department_id: UUID | None
    folder_id: UUID | None
    metrics_json: dict | None
    generated_at: datetime | None
    status: str
    company_id: UUID
    version: int
