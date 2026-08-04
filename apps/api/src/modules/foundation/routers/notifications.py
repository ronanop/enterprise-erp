"""Notification router — Foundation Notification Engine APIs."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import (
    DeviceTokenRegisterRequest,
    EmailComposeRequest,
    NotificationSendRequest,
    NotificationTemplateCreateRequest,
)
from modules.foundation.service.notification_service import NotificationService
from shared.schemas import APIResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _template_dict(t) -> dict:
    return {
        "id": str(t.id),
        "tenant_id": str(t.tenant_id),
        "template_code": t.template_code,
        "template_name": t.template_name,
        "channel": t.channel,
        "subject_template": t.subject_template,
        "body_template": t.body_template,
        "locale": t.locale,
        "is_active": t.is_active,
    }


@router.get("/templates", response_model=APIResponse[list])
def list_templates(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    channel: Annotated[str | None, Query()] = None,
) -> APIResponse[list]:
    templates = NotificationService(db).list_templates(ctx.tenant_id, channel=channel)
    return APIResponse(message="Templates retrieved", data=[_template_dict(t) for t in templates])


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
    return APIResponse(message="Template created", data=_template_dict(template))


@router.get("/events", response_model=APIResponse[list])
def list_events(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> APIResponse[list]:
    events = NotificationService(db).list_events(ctx.tenant_id, limit=limit)
    return APIResponse(message="Events retrieved", data=events)


@router.get("/deliveries", response_model=APIResponse[list])
def list_deliveries(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> APIResponse[list]:
    deliveries = NotificationService(db).list_deliveries(ctx.tenant_id, limit=limit)
    return APIResponse(message="Deliveries retrieved", data=deliveries)


@router.get("/email/status", response_model=APIResponse[dict])
def email_provider_status(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    _ = ctx, db
    status = NotificationService(db).email_provider_status()
    return APIResponse(message="Email provider status", data=status)


@router.post("/email/test", response_model=APIResponse[dict])
def test_email_connection(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    _ = ctx
    result = NotificationService(db).test_email_connection()
    return APIResponse(
        message="Connection test completed" if result["ok"] else "Connection test failed",
        data=result,
    )


@router.get("/email/overview", response_model=APIResponse[dict])
def email_overview(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    data = NotificationService(db).overview(ctx.tenant_id)
    return APIResponse(message="Email overview", data=data)


@router.post("/email/send", response_model=APIResponse[dict])
def send_email(
    body: EmailComposeRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    event = NotificationService(db).send_email(
        tenant_id=ctx.tenant_id,
        to_address=body.to_address,
        subject=body.subject,
        body_html=body.body_html,
        event_type=body.event_type,
        template_id=body.template_id,
        payload_json=body.payload_json,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(
        message="Email queued" if event.status == "queued" else f"Email {event.status}",
        data={
            "id": str(event.id),
            "status": event.status,
            "recipient_address": event.recipient_address,
            "event_type": event.event_type,
        },
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
        message="Notification queued" if event.status == "queued" else f"Notification {event.status}",
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
