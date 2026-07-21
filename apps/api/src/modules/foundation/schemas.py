"""Pydantic schemas for foundation APIs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class MfaVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    session_id: str | None = None
    mfa_required: bool = False
    mfa_challenge_token: str | None = None


class TenantCreateRequest(BaseModel):
    tenant_code: str = Field(max_length=50)
    tenant_name: str = Field(max_length=255)


class TenantUpdateRequest(BaseModel):
    tenant_name: str | None = None
    status: str | None = None
    timezone: str | None = None
    locale: str | None = None


class TenantResponse(BaseModel):
    id: UUID
    tenant_code: str
    tenant_name: str
    status: str
    timezone: str
    locale: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str
    user_type: str = "employee"


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    status: str | None = None
    user_type: str | None = None


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    display_name: str
    user_type: str
    status: str
    mfa_enabled: bool
    role_ids: list[UUID] = Field(default_factory=list)


class RoleCreateRequest(BaseModel):
    role_code: str
    role_name: str
    description: str | None = None


class RoleUpdateRequest(BaseModel):
    role_name: str | None = None
    description: str | None = None
    status: str | None = None


class RoleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    role_code: str
    role_name: str
    status: str
    is_system_role: bool
    permission_ids: list[UUID] = Field(default_factory=list)


class PermissionResponse(BaseModel):
    id: UUID
    permission_code: str
    resource: str
    action: str
    module: str
    description: str | None = None


class AssignRoleRequest(BaseModel):
    role_id: UUID


class GrantPermissionRequest(BaseModel):
    permission_id: UUID


class WorkflowDefinitionCreateRequest(BaseModel):
    workflow_code: str
    workflow_name: str
    module: str
    document_type: str


class WorkflowStepCreateRequest(BaseModel):
    step_order: int
    step_code: str
    step_name: str
    approver_type: str


class WorkflowInstanceCreateRequest(BaseModel):
    workflow_id: UUID
    entity_name: str
    entity_id: UUID


class WorkflowActionRequest(BaseModel):
    comments: str | None = None


class NotificationTemplateCreateRequest(BaseModel):
    template_code: str
    template_name: str
    channel: str
    body_template: str
    subject_template: str | None = None


class NotificationSendRequest(BaseModel):
    template_id: UUID
    event_type: str
    recipient_user_id: UUID | None = None
    recipient_address: str | None = None
    payload_json: dict | None = None


class SettingUpsertRequest(BaseModel):
    setting_value: str
    value_type: str = "string"
    scope: str = "tenant"


class AuditLogResponse(BaseModel):
    id: UUID
    tenant_id: UUID | None
    entity_name: str
    entity_id: UUID
    operation: str
    performed_at: datetime
    performed_by: UUID | None = None
