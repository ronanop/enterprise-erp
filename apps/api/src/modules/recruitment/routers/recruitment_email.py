"""Recruitment-scoped email compose — HR can send ATS invites without foundation.notification:create."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_any_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import EmailComposeRequest
from modules.foundation.service.notification_service import NotificationService
from modules.recruitment.dependencies import get_db
from shared.schemas import APIResponse

recruitment_email_router = APIRouter(
    prefix="/email",
    tags=["Recruitment - Email"],
)


@recruitment_email_router.post("/send", response_model=APIResponse[dict])
def send_recruitment_email(
    body: EmailComposeRequest,
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "recruitment.interview:create",
                "recruitment.offer:create",
                "recruitment.application:update",
                "recruitment.candidate:create",
                "recruitment.job_requisition:create",
                "foundation.notification:create",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    """Send SMTP email for ATS flows (interview invites, offers, portal mail)."""
    event_type = body.event_type or "recruitment.email"
    if not str(event_type).startswith("recruitment."):
        event_type = f"recruitment.{event_type}"

    event = NotificationService(db).send_email(
        tenant_id=ctx.tenant_id,
        to_address=body.to_address,
        subject=body.subject,
        body_html=body.body_html,
        event_type=event_type,
        template_id=body.template_id,
        payload_json=body.payload_json,
        created_by=ctx.user_id,
        attachments=[
            {
                "filename": item.filename,
                "content_base64": item.content_base64,
                "content_type": item.content_type,
            }
            for item in body.attachments
        ]
        if body.attachments
        else None,
    )
    db.commit()
    db.refresh(event)
    provider_error: str | None = None
    if event.status == "failed":
        for d in NotificationService(db).list_deliveries(ctx.tenant_id, limit=30):
            if str(d.get("event_id") or "") == str(event.id) and d.get("channel") == "email":
                provider_error = d.get("provider_response") or d.get("status")
                break
    return APIResponse(
        message="Email queued" if event.status == "queued" else f"Email {event.status}",
        data={
            "id": str(event.id),
            "status": event.status,
            "recipient_address": event.recipient_address,
            "event_type": event.event_type,
            "error": provider_error,
        },
    )
