"""Integration API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.integration.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.integration.schemas import (
    ApiCredentialCreate,
    ApiCredentialResponse,
    ApiCredentialUpdate,
    ApiUsageCreate,
    ApiUsageResponse,
    ApiUsageUpdate,
    ConnectorCreate,
    ConnectorResponse,
    ConnectorUpdate,
    DataMappingCreate,
    DataMappingResponse,
    DataMappingUpdate,
    DataTransformationCreate,
    DataTransformationResponse,
    DataTransformationUpdate,
    DeadLetterCreate,
    DeadLetterResponse,
    DeadLetterUpdate,
    EventDefinitionCreate,
    EventDefinitionResponse,
    EventDefinitionUpdate,
    EventSubscriptionCreate,
    EventSubscriptionResponse,
    EventSubscriptionUpdate,
    ExternalSystemCreate,
    ExternalSystemResponse,
    ExternalSystemUpdate,
    MessageCreate,
    MessageQueueCreate,
    MessageQueueResponse,
    MessageQueueUpdate,
    MessageResponse,
    MessageUpdate,
    MonitorCreate,
    MonitorResponse,
    MonitorUpdate,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    OauthClientCreate,
    OauthClientResponse,
    OauthClientUpdate,
    RateLimitCreate,
    RateLimitResponse,
    RateLimitUpdate,
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    RetryQueueCreate,
    RetryQueueResponse,
    RetryQueueUpdate,
    SyncJobCreate,
    SyncJobResponse,
    SyncJobUpdate,
    SyncLogCreate,
    SyncLogResponse,
    SyncLogUpdate,
    WebhookCreate,
    WebhookResponse,
    WebhookUpdate,
)
from modules.integration.service import (
    ApiCredentialService,
    ApiUsageService,
    ConnectorService,
    DataMappingService,
    DataTransformationService,
    DeadLetterService,
    EventDefinitionService,
    EventSubscriptionService,
    ExternalSystemService,
    MessageQueueService,
    MessageService,
    MonitorService,
    NotificationService,
    OauthClientService,
    RateLimitService,
    ReportService,
    RetryQueueService,
    SyncJobService,
    SyncLogService,
    WebhookService,
)
from shared.schemas import APIResponse

external_systems_router = APIRouter(prefix="/external-systems", tags=["Integration - ExternalSystem"])

@external_systems_router.get("", response_model=APIResponse[list[ExternalSystemResponse]])
def list_external_systems(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.system:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ExternalSystemService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@external_systems_router.get("/{row_id}", response_model=APIResponse[ExternalSystemResponse])
def get_external_systems(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.system:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ExternalSystemService(db).get(ctx, row_id))

@external_systems_router.post("", response_model=APIResponse[ExternalSystemResponse])
def create_external_systems(
    body: ExternalSystemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.system:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ExternalSystemService(db).create(ctx, **body.model_dump(exclude_none=True)))

@external_systems_router.patch("/{row_id}", response_model=APIResponse[ExternalSystemResponse])
def update_external_systems(
    row_id: UUID,
    body: ExternalSystemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.system:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ExternalSystemService(db).update(ctx, row_id, **extract_update_fields(body)))

connectors_router = APIRouter(prefix="/connectors", tags=["Integration - Connector"])

@connectors_router.get("", response_model=APIResponse[list[ConnectorResponse]])
def list_connectors(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ConnectorService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@connectors_router.get("/{row_id}", response_model=APIResponse[ConnectorResponse])
def get_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ConnectorService(db).get(ctx, row_id))

@connectors_router.post("", response_model=APIResponse[ConnectorResponse])
def create_connectors(
    body: ConnectorCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ConnectorService(db).create(ctx, **body.model_dump(exclude_none=True)))

@connectors_router.patch("/{row_id}", response_model=APIResponse[ConnectorResponse])
def update_connectors(
    row_id: UUID,
    body: ConnectorUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ConnectorService(db).update(ctx, row_id, **extract_update_fields(body)))

@connectors_router.post("/{row_id}/submit", response_model=APIResponse[ConnectorResponse])
def submit_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ConnectorService(db).submit(ctx, row_id))

@connectors_router.post("/{row_id}/approve", response_model=APIResponse[ConnectorResponse])
def approve_connectors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.connector:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ConnectorService(db).approve(ctx, row_id))

api_credentials_router = APIRouter(prefix="/api-credentials", tags=["Integration - ApiCredential"])

@api_credentials_router.get("", response_model=APIResponse[list[ApiCredentialResponse]])
def list_api_credentials(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ApiCredentialService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@api_credentials_router.get("/{row_id}", response_model=APIResponse[ApiCredentialResponse])
def get_api_credentials(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ApiCredentialService(db).get(ctx, row_id))

@api_credentials_router.post("", response_model=APIResponse[ApiCredentialResponse])
def create_api_credentials(
    body: ApiCredentialCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ApiCredentialService(db).create(ctx, **body.model_dump(exclude_none=True)))

@api_credentials_router.patch("/{row_id}", response_model=APIResponse[ApiCredentialResponse])
def update_api_credentials(
    row_id: UUID,
    body: ApiCredentialUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ApiCredentialService(db).update(ctx, row_id, **extract_update_fields(body)))

@api_credentials_router.post("/{row_id}/submit", response_model=APIResponse[ApiCredentialResponse])
def submit_api_credentials(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ApiCredentialService(db).submit(ctx, row_id))

@api_credentials_router.post("/{row_id}/approve", response_model=APIResponse[ApiCredentialResponse])
def approve_api_credentials(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.credential:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ApiCredentialService(db).approve(ctx, row_id))

oauth_clients_router = APIRouter(prefix="/oauth-clients", tags=["Integration - OauthClient"])

@oauth_clients_router.get("", response_model=APIResponse[list[OauthClientResponse]])
def list_oauth_clients(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.oauth:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = OauthClientService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@oauth_clients_router.get("/{row_id}", response_model=APIResponse[OauthClientResponse])
def get_oauth_clients(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.oauth:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OauthClientService(db).get(ctx, row_id))

@oauth_clients_router.post("", response_model=APIResponse[OauthClientResponse])
def create_oauth_clients(
    body: OauthClientCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.oauth:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OauthClientService(db).create(ctx, **body.model_dump(exclude_none=True)))

@oauth_clients_router.patch("/{row_id}", response_model=APIResponse[OauthClientResponse])
def update_oauth_clients(
    row_id: UUID,
    body: OauthClientUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.oauth:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OauthClientService(db).update(ctx, row_id, **extract_update_fields(body)))

webhooks_router = APIRouter(prefix="/webhooks", tags=["Integration - Webhook"])

@webhooks_router.get("", response_model=APIResponse[list[WebhookResponse]])
def list_webhooks(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = WebhookService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@webhooks_router.get("/{row_id}", response_model=APIResponse[WebhookResponse])
def get_webhooks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=WebhookService(db).get(ctx, row_id))

@webhooks_router.post("", response_model=APIResponse[WebhookResponse])
def create_webhooks(
    body: WebhookCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=WebhookService(db).create(ctx, **body.model_dump(exclude_none=True)))

@webhooks_router.patch("/{row_id}", response_model=APIResponse[WebhookResponse])
def update_webhooks(
    row_id: UUID,
    body: WebhookUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=WebhookService(db).update(ctx, row_id, **extract_update_fields(body)))

@webhooks_router.post("/{row_id}/submit", response_model=APIResponse[WebhookResponse])
def submit_webhooks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=WebhookService(db).submit(ctx, row_id))

@webhooks_router.post("/{row_id}/approve", response_model=APIResponse[WebhookResponse])
def approve_webhooks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.webhook:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=WebhookService(db).approve(ctx, row_id))

event_definitions_router = APIRouter(prefix="/event-definitions", tags=["Integration - EventDefinition"])

@event_definitions_router.get("", response_model=APIResponse[list[EventDefinitionResponse]])
def list_event_definitions(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.event:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = EventDefinitionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@event_definitions_router.get("/{row_id}", response_model=APIResponse[EventDefinitionResponse])
def get_event_definitions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.event:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EventDefinitionService(db).get(ctx, row_id))

@event_definitions_router.post("", response_model=APIResponse[EventDefinitionResponse])
def create_event_definitions(
    body: EventDefinitionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.event:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=EventDefinitionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@event_definitions_router.patch("/{row_id}", response_model=APIResponse[EventDefinitionResponse])
def update_event_definitions(
    row_id: UUID,
    body: EventDefinitionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.event:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=EventDefinitionService(db).update(ctx, row_id, **extract_update_fields(body)))

event_subscriptions_router = APIRouter(prefix="/event-subscriptions", tags=["Integration - EventSubscription"])

@event_subscriptions_router.get("", response_model=APIResponse[list[EventSubscriptionResponse]])
def list_event_subscriptions(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.subscription:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = EventSubscriptionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@event_subscriptions_router.get("/{row_id}", response_model=APIResponse[EventSubscriptionResponse])
def get_event_subscriptions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.subscription:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EventSubscriptionService(db).get(ctx, row_id))

@event_subscriptions_router.post("", response_model=APIResponse[EventSubscriptionResponse])
def create_event_subscriptions(
    body: EventSubscriptionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.subscription:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=EventSubscriptionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@event_subscriptions_router.patch("/{row_id}", response_model=APIResponse[EventSubscriptionResponse])
def update_event_subscriptions(
    row_id: UUID,
    body: EventSubscriptionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.subscription:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=EventSubscriptionService(db).update(ctx, row_id, **extract_update_fields(body)))

message_queues_router = APIRouter(prefix="/message-queues", tags=["Integration - MessageQueue"])

@message_queues_router.get("", response_model=APIResponse[list[MessageQueueResponse]])
def list_message_queues(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.queue:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MessageQueueService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@message_queues_router.get("/{row_id}", response_model=APIResponse[MessageQueueResponse])
def get_message_queues(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.queue:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MessageQueueService(db).get(ctx, row_id))

@message_queues_router.post("", response_model=APIResponse[MessageQueueResponse])
def create_message_queues(
    body: MessageQueueCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.queue:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MessageQueueService(db).create(ctx, **body.model_dump(exclude_none=True)))

@message_queues_router.patch("/{row_id}", response_model=APIResponse[MessageQueueResponse])
def update_message_queues(
    row_id: UUID,
    body: MessageQueueUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.queue:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MessageQueueService(db).update(ctx, row_id, **extract_update_fields(body)))

messages_router = APIRouter(prefix="/messages", tags=["Integration - Message"])

@messages_router.get("", response_model=APIResponse[list[MessageResponse]])
def list_messages(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.message:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MessageService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@messages_router.get("/{row_id}", response_model=APIResponse[MessageResponse])
def get_messages(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.message:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MessageService(db).get(ctx, row_id))

@messages_router.post("", response_model=APIResponse[MessageResponse])
def create_messages(
    body: MessageCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.message:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MessageService(db).create(ctx, **body.model_dump(exclude_none=True)))

@messages_router.patch("/{row_id}", response_model=APIResponse[MessageResponse])
def update_messages(
    row_id: UUID,
    body: MessageUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.message:requeue"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MessageService(db).update(ctx, row_id, **extract_update_fields(body)))

retry_queues_router = APIRouter(prefix="/retry-queues", tags=["Integration - RetryQueue"])

@retry_queues_router.get("", response_model=APIResponse[list[RetryQueueResponse]])
def list_retry_queues(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.retry:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RetryQueueService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@retry_queues_router.get("/{row_id}", response_model=APIResponse[RetryQueueResponse])
def get_retry_queues(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.retry:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RetryQueueService(db).get(ctx, row_id))

@retry_queues_router.post("", response_model=APIResponse[RetryQueueResponse])
def create_retry_queues(
    body: RetryQueueCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.retry:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RetryQueueService(db).create(ctx, **body.model_dump(exclude_none=True)))

@retry_queues_router.patch("/{row_id}", response_model=APIResponse[RetryQueueResponse])
def update_retry_queues(
    row_id: UUID,
    body: RetryQueueUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.retry:review"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RetryQueueService(db).update(ctx, row_id, **extract_update_fields(body)))

@retry_queues_router.post("/{row_id}/submit", response_model=APIResponse[RetryQueueResponse])
def submit_retry_queues(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.retry:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=RetryQueueService(db).submit(ctx, row_id))

dead_letters_router = APIRouter(prefix="/dead-letters", tags=["Integration - DeadLetter"])

@dead_letters_router.get("", response_model=APIResponse[list[DeadLetterResponse]])
def list_dead_letters(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.dlq:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DeadLetterService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dead_letters_router.get("/{row_id}", response_model=APIResponse[DeadLetterResponse])
def get_dead_letters(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.dlq:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DeadLetterService(db).get(ctx, row_id))

@dead_letters_router.post("", response_model=APIResponse[DeadLetterResponse])
def create_dead_letters(
    body: DeadLetterCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.dlq:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DeadLetterService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dead_letters_router.patch("/{row_id}", response_model=APIResponse[DeadLetterResponse])
def update_dead_letters(
    row_id: UUID,
    body: DeadLetterUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.dlq:review"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DeadLetterService(db).update(ctx, row_id, **extract_update_fields(body)))

@dead_letters_router.post("/{row_id}/reprocess", response_model=APIResponse[DeadLetterResponse])
def reprocess_dead_letters(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.dlq:reprocess"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="reprocess", data=DeadLetterService(db).reprocess(ctx, row_id))

data_mappings_router = APIRouter(prefix="/data-mappings", tags=["Integration - DataMapping"])

@data_mappings_router.get("", response_model=APIResponse[list[DataMappingResponse]])
def list_data_mappings(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.mapping:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataMappingService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_mappings_router.get("/{row_id}", response_model=APIResponse[DataMappingResponse])
def get_data_mappings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.mapping:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataMappingService(db).get(ctx, row_id))

@data_mappings_router.post("", response_model=APIResponse[DataMappingResponse])
def create_data_mappings(
    body: DataMappingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.mapping:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataMappingService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_mappings_router.patch("/{row_id}", response_model=APIResponse[DataMappingResponse])
def update_data_mappings(
    row_id: UUID,
    body: DataMappingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.mapping:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataMappingService(db).update(ctx, row_id, **extract_update_fields(body)))

data_transformations_router = APIRouter(prefix="/data-transformations", tags=["Integration - DataTransformation"])

@data_transformations_router.get("", response_model=APIResponse[list[DataTransformationResponse]])
def list_data_transformations(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.transformation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataTransformationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_transformations_router.get("/{row_id}", response_model=APIResponse[DataTransformationResponse])
def get_data_transformations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.transformation:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataTransformationService(db).get(ctx, row_id))

@data_transformations_router.post("", response_model=APIResponse[DataTransformationResponse])
def create_data_transformations(
    body: DataTransformationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.transformation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataTransformationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_transformations_router.patch("/{row_id}", response_model=APIResponse[DataTransformationResponse])
def update_data_transformations(
    row_id: UUID,
    body: DataTransformationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.transformation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataTransformationService(db).update(ctx, row_id, **extract_update_fields(body)))

sync_jobs_router = APIRouter(prefix="/sync-jobs", tags=["Integration - SyncJob"])

@sync_jobs_router.get("", response_model=APIResponse[list[SyncJobResponse]])
def list_sync_jobs(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SyncJobService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@sync_jobs_router.get("/{row_id}", response_model=APIResponse[SyncJobResponse])
def get_sync_jobs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SyncJobService(db).get(ctx, row_id))

@sync_jobs_router.post("", response_model=APIResponse[SyncJobResponse])
def create_sync_jobs(
    body: SyncJobCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SyncJobService(db).create(ctx, **body.model_dump(exclude_none=True)))

@sync_jobs_router.patch("/{row_id}", response_model=APIResponse[SyncJobResponse])
def update_sync_jobs(
    row_id: UUID,
    body: SyncJobUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SyncJobService(db).update(ctx, row_id, **extract_update_fields(body)))

@sync_jobs_router.post("/{row_id}/submit", response_model=APIResponse[SyncJobResponse])
def submit_sync_jobs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=SyncJobService(db).submit(ctx, row_id))

@sync_jobs_router.post("/{row_id}/approve", response_model=APIResponse[SyncJobResponse])
def approve_sync_jobs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=SyncJobService(db).approve(ctx, row_id))

@sync_jobs_router.post("/{row_id}/run", response_model=APIResponse[SyncJobResponse])
def run_sync_jobs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:run"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="run", data=SyncJobService(db).run(ctx, row_id))

sync_logs_router = APIRouter(prefix="/sync-logs", tags=["Integration - SyncLog"])

@sync_logs_router.get("", response_model=APIResponse[list[SyncLogResponse]])
def list_sync_logs(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SyncLogService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@sync_logs_router.get("/{row_id}", response_model=APIResponse[SyncLogResponse])
def get_sync_logs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SyncLogService(db).get(ctx, row_id))

@sync_logs_router.post("", response_model=APIResponse[SyncLogResponse])
def create_sync_logs(
    body: SyncLogCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SyncLogService(db).create(ctx, **body.model_dump(exclude_none=True)))

@sync_logs_router.patch("/{row_id}", response_model=APIResponse[SyncLogResponse])
def update_sync_logs(
    row_id: UUID,
    body: SyncLogUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.sync:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SyncLogService(db).update(ctx, row_id, **extract_update_fields(body)))

api_usages_router = APIRouter(prefix="/api-usages", tags=["Integration - ApiUsage"])

@api_usages_router.get("", response_model=APIResponse[list[ApiUsageResponse]])
def list_api_usages(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.usage:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ApiUsageService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@api_usages_router.get("/{row_id}", response_model=APIResponse[ApiUsageResponse])
def get_api_usages(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.usage:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ApiUsageService(db).get(ctx, row_id))

@api_usages_router.post("", response_model=APIResponse[ApiUsageResponse])
def create_api_usages(
    body: ApiUsageCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.usage:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ApiUsageService(db).create(ctx, **body.model_dump(exclude_none=True)))

@api_usages_router.patch("/{row_id}", response_model=APIResponse[ApiUsageResponse])
def update_api_usages(
    row_id: UUID,
    body: ApiUsageUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.usage:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ApiUsageService(db).update(ctx, row_id, **extract_update_fields(body)))

rate_limits_router = APIRouter(prefix="/rate-limits", tags=["Integration - RateLimit"])

@rate_limits_router.get("", response_model=APIResponse[list[RateLimitResponse]])
def list_rate_limits(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.rate_limit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RateLimitService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@rate_limits_router.get("/{row_id}", response_model=APIResponse[RateLimitResponse])
def get_rate_limits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.rate_limit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RateLimitService(db).get(ctx, row_id))

@rate_limits_router.post("", response_model=APIResponse[RateLimitResponse])
def create_rate_limits(
    body: RateLimitCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.rate_limit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RateLimitService(db).create(ctx, **body.model_dump(exclude_none=True)))

@rate_limits_router.patch("/{row_id}", response_model=APIResponse[RateLimitResponse])
def update_rate_limits(
    row_id: UUID,
    body: RateLimitUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.rate_limit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RateLimitService(db).update(ctx, row_id, **extract_update_fields(body)))

notifications_router = APIRouter(prefix="/notifications", tags=["Integration - Notification"])

@notifications_router.get("", response_model=APIResponse[list[NotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@notifications_router.get("/{row_id}", response_model=APIResponse[NotificationResponse])
def get_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@notifications_router.post("", response_model=APIResponse[NotificationResponse])
def create_notifications(
    body: NotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@notifications_router.patch("/{row_id}", response_model=APIResponse[NotificationResponse])
def update_notifications(
    row_id: UUID,
    body: NotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@notifications_router.post("/{row_id}/acknowledge", response_model=APIResponse[NotificationResponse])
def acknowledge_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.notification:acknowledge"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="acknowledge", data=NotificationService(db).acknowledge(ctx, row_id))

monitors_router = APIRouter(prefix="/monitors", tags=["Integration - Monitor"])

@monitors_router.get("", response_model=APIResponse[list[MonitorResponse]])
def list_monitors(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.monitor:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MonitorService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@monitors_router.get("/{row_id}", response_model=APIResponse[MonitorResponse])
def get_monitors(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.monitor:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MonitorService(db).get(ctx, row_id))

@monitors_router.post("", response_model=APIResponse[MonitorResponse])
def create_monitors(
    body: MonitorCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.monitor:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MonitorService(db).create(ctx, **body.model_dump(exclude_none=True)))

@monitors_router.patch("/{row_id}", response_model=APIResponse[MonitorResponse])
def update_monitors(
    row_id: UUID,
    body: MonitorUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.monitor:acknowledge"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MonitorService(db).update(ctx, row_id, **extract_update_fields(body)))

reports_router = APIRouter(prefix="/reports", tags=["Integration - Report"])

@reports_router.get("", response_model=APIResponse[list[ReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("integration.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ReportResponse])
def create_reports(
    body: ReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ReportResponse])
def update_reports(
    row_id: UUID,
    body: ReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("integration.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReportService(db).update(ctx, row_id, **extract_update_fields(body)))

