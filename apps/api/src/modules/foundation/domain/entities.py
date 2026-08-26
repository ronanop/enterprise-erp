"""Foundation domain entities (pure Python, no ORM)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass
class TenantEntity:
    id: UUID
    tenant_code: str
    tenant_name: str
    status: str
    timezone: str
    locale: str
    subscription_plan: str | None = None
    max_companies: int | None = None
    max_users: int | None = None
    version: int = 1
    is_deleted: bool = False


@dataclass
class UserEntity:
    id: UUID
    tenant_id: UUID
    email: str
    display_name: str
    user_type: str
    status: str
    mfa_enabled: bool = False
    version: int = 1
    is_deleted: bool = False
    last_login_at: datetime | None = None
    failed_login_count: int = 0
    locked_until: datetime | None = None
    role_ids: list[UUID] = field(default_factory=list)
    assigned_module_keys: list[str] = field(default_factory=list)
    admin_module_keys: list[str] = field(default_factory=list)
    role_codes: list[str] = field(default_factory=list)
    employee_id: UUID | None = None


@dataclass
class RoleEntity:
    id: UUID
    tenant_id: UUID
    role_code: str
    role_name: str
    status: str
    is_system_role: bool = False
    description: str | None = None
    permission_ids: list[UUID] = field(default_factory=list)


@dataclass
class PermissionEntity:
    id: UUID
    permission_code: str
    resource: str
    action: str
    module: str
    is_active: bool = True
    description: str | None = None


@dataclass
class SessionEntity:
    id: UUID
    tenant_id: UUID
    user_id: UUID
    issued_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None


@dataclass
class WorkflowDefinitionEntity:
    id: UUID
    tenant_id: UUID
    workflow_code: str
    workflow_name: str
    module: str
    document_type: str
    version_no: int
    is_active: bool = True


@dataclass
class WorkflowInstanceEntity:
    id: UUID
    tenant_id: UUID
    workflow_id: UUID
    entity_name: str
    entity_id: UUID
    status: str
    started_at: datetime
    started_by: UUID
    current_step_id: UUID | None = None
    company_id: UUID | None = None


@dataclass
class NotificationTemplateEntity:
    id: UUID
    tenant_id: UUID
    template_code: str
    template_name: str
    channel: str
    body_template: str
    locale: str = "en"
    subject_template: str | None = None
    is_active: bool = True


@dataclass
class AuditLogEntity:
    id: UUID
    entity_name: str
    entity_id: UUID
    operation: str
    performed_at: datetime
    tenant_id: UUID | None = None
    performed_by: UUID | None = None
    old_value: dict | None = None
    new_value: dict | None = None


@dataclass
class SettingEntity:
    id: UUID
    tenant_id: UUID
    setting_key: str
    setting_value: str
    value_type: str
    scope: str
    company_id: UUID | None = None
    branch_id: UUID | None = None
    is_encrypted: bool = False
    description: str | None = None
