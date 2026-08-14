"""Notification router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import (
    DeviceTokenRegisterRequest,
    NotificationInboxItemResponse,
    NotificationSendRequest,
    NotificationTemplateCreateRequest,
    NotificationUnreadCountResponse,
)
from modules.foundation.service.notification_service import NotificationService
from shared.schemas import APIResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _inbox_response(item) -> NotificationInboxItemResponse:
    return NotificationInboxItemResponse(
        id=item.id,
        title=item.title,
        body=item.body,
        kind=item.kind,
        unread=item.unread,
        created_at=item.created_at,
        href=item.href,
        read_at=item.read_at,
    )


@router.get("/inbox", response_model=APIResponse[list[NotificationInboxItemResponse]])
def list_inbox(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[NotificationInboxItemResponse]]:
    items = NotificationService(db).list_inbox(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    return APIResponse(message="Inbox retrieved", data=[_inbox_response(item) for item in items])


@router.get("/unread-count", response_model=APIResponse[NotificationUnreadCountResponse])
def unread_count(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[NotificationUnreadCountResponse]:
    count = NotificationService(db).unread_count(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    return APIResponse(
        message="Unread count retrieved",
        data=NotificationUnreadCountResponse(unread_count=count),
    )


@router.post("/read-all", response_model=APIResponse[dict])
def mark_all_read(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    marked = NotificationService(db).mark_all_read(tenant_id=ctx.tenant_id, user_id=ctx.user_id)
    db.commit()
    return APIResponse(message="Notifications marked read", data={"marked": marked})


@router.post("/{notification_id}/read", response_model=APIResponse[NotificationInboxItemResponse])
def mark_read(
    notification_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[NotificationInboxItemResponse]:
    item = NotificationService(db).mark_read(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        event_id=notification_id,
    )
    db.commit()
    return APIResponse(message="Notification marked read", data=_inbox_response(item))


@router.get("/templates", response_model=APIResponse[list])
def list_templates(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list]:
    templates = NotificationService(db).list_templates(ctx.tenant_id)
    return APIResponse(message="Templates retrieved", data=[t.__dict__ for t in templates])


@router.post("/templates", response_model=APIResponse[dict])
def create_template(
    body: NotificationTemplateCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    template = NotificationService(db).create_template(
        tenant_id=ctx.tenant_id,
        template_code=body.template_code,
        template_name=body.template_name,
        channel=body.channel,
        body_template=body.body_template,
        subject_template=body.subject_template,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="Template created", data=template.__dict__)


@router.get("/events", response_model=APIResponse[list])
def list_events(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list]:
    events = NotificationService(db).list_events(ctx.tenant_id)
    return APIResponse(
        message="Events retrieved",
        data=[{"id": str(e.id), "status": e.status, "event_type": e.event_type} for e in events],
    )


@router.post("/send", response_model=APIResponse[dict])
def send_notification(
    body: NotificationSendRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    event = NotificationService(db).send(
        tenant_id=ctx.tenant_id,
        template_id=body.template_id,
        event_type=body.event_type,
        recipient_user_id=body.recipient_user_id,
        recipient_address=body.recipient_address,
        payload_json=body.payload_json,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(
        message="Notification queued",
        data={"id": str(event.id), "status": event.status},
    )


@router.post("/device-tokens", response_model=APIResponse[dict])
def register_device_token(
    body: DeviceTokenRegisterRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    if ctx.user_id is None:
        from core.exceptions import AppException

        raise AppException("Authenticated user required to register device token")
    row = NotificationService(db).register_device_token(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        token=body.token,
        platform=body.platform,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(
        message="Device token registered",
        data={
            "id": str(row.id),
            "platform": row.platform,
            "is_active": row.is_active,
        },
    )
