"""Integration Pydantic schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ExternalSystemCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ExternalSystemUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ExternalSystemResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    system_number: str
    system_code: str
    system_name: str
    system_type: str
    base_url: str | None
    environment: str
    owner_employee_id: UUID | None
    department_id: UUID | None
    vendor_id: UUID | None
    customer_id: UUID | None
    status: str
    company_id: UUID
    version: int

class ConnectorCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ConnectorUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ConnectorResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    connector_number: str
    connector_code: str
    connector_name: str
    external_system_id: UUID
    connector_protocol: str
    direction: str
    owner_employee_id: UUID | None
    config_json: dict | None
    credential_id: UUID | None
    oauth_client_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class ApiCredentialCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ApiCredentialUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ApiCredentialResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    credential_number: str
    external_system_id: UUID
    credential_type: str
    secret_vault_ref: str
    key_hint: str | None
    expires_at: datetime | None
    rotated_at: datetime | None
    owner_employee_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class OauthClientCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class OauthClientUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class OauthClientResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    client_number: str
    external_system_id: UUID
    client_id_public: str
    client_secret_vault_ref: str
    token_url: str | None
    authorize_url: str | None
    scopes: str | None
    grant_type: str
    token_expires_at: datetime | None
    status: str
    company_id: UUID
    version: int

class WebhookCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class WebhookUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class WebhookResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    webhook_number: str
    external_system_id: UUID | None
    connector_id: UUID | None
    direction: str
    target_url: str
    event_definition_id: UUID | None
    secret_vault_ref: str | None
    is_enabled: bool
    owner_employee_id: UUID | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class EventDefinitionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class EventDefinitionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class EventDefinitionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    event_code: str
    event_name: str
    source_module: str
    payload_schema_json: dict | None
    is_active: bool
    version_no: int
    status: str
    company_id: UUID
    version: int

class EventSubscriptionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class EventSubscriptionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class EventSubscriptionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    subscription_number: str
    event_definition_id: UUID
    subscriber_type: str
    webhook_id: UUID | None
    message_queue_id: UUID | None
    connector_id: UUID | None
    filter_json: dict | None
    status: str
    company_id: UUID
    version: int

class MessageQueueCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageQueueUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageQueueResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    queue_code: str
    queue_name: str
    queue_type: str
    max_retries: int
    visibility_timeout_sec: int
    status: str
    company_id: UUID
    version: int

class MessageCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MessageUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MessageResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    message_number: str
    message_queue_id: UUID
    event_definition_id: UUID | None
    correlation_id: str | None
    payload_json: dict | None
    source_module: str | None
    entity_ref_id: UUID | None
    finance_event_ref_id: UUID | None
    priority: int
    available_at: datetime | None
    status: str
    company_id: UUID
    version: int

class RetryQueueCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RetryQueueUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RetryQueueResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    retry_number: str
    message_id: UUID
    attempt_no: int
    next_attempt_at: datetime | None
    last_error: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class DeadLetterCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DeadLetterUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DeadLetterResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dlq_number: str
    message_id: UUID
    retry_id: UUID | None
    reason: str | None
    payload_json: dict | None
    failed_at: datetime | None
    reprocessed_at: datetime | None
    status: str
    company_id: UUID
    version: int

class DataMappingCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataMappingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataMappingResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    mapping_code: str
    mapping_name: str
    connector_id: UUID
    source_entity: str | None
    target_entity: str | None
    mapping_json: dict | None
    status: str
    company_id: UUID
    version: int

class DataTransformationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataTransformationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataTransformationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    transformation_code: str
    transformation_name: str
    mapping_id: UUID
    transform_type: str
    definition_json: dict | None
    sequence_no: int
    status: str
    company_id: UUID
    version: int

class SyncJobCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SyncJobUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SyncJobResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    sync_number: str
    connector_id: UUID
    mapping_id: UUID | None
    sync_mode: str
    direction: str
    schedule_cron: str | None
    requested_by_employee_id: UUID
    started_at: datetime | None
    completed_at: datetime | None
    rows_processed: int | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class SyncLogCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SyncLogUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SyncLogResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    sync_job_id: UUID
    logged_at: datetime | None
    level: str
    message: str | None
    entity_ref_id: UUID | None
    payload_json: dict | None
    status: str
    company_id: UUID
    version: int

class ApiUsageCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ApiUsageUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ApiUsageResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    credential_id: UUID | None
    oauth_client_id: UUID | None
    connector_id: UUID | None
    occurred_at: datetime | None
    endpoint: str | None
    http_method: str | None
    status_code: int | None
    latency_ms: int | None
    bytes_in: int | None
    bytes_out: int | None
    status: str
    company_id: UUID
    version: int

class RateLimitCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class RateLimitUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class RateLimitResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    limit_code: str
    external_system_id: UUID | None
    credential_id: UUID | None
    connector_id: UUID | None
    window_seconds: int
    max_requests: int
    burst_max: int | None
    status: str
    company_id: UUID
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

class MonitorCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MonitorUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MonitorResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    monitor_code: str
    monitor_name: str
    external_system_id: UUID | None
    connector_id: UUID | None
    check_type: str
    threshold_json: dict | None
    last_checked_at: datetime | None
    last_status: str | None
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
