"""Inbound email webhook for automatic service request ticket creation."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from modules.service.dependencies import TenantContext, get_db, require_permission
from modules.service.email_inbound_schemas import (
    EmailAutomationStatus,
    EmailToTicketResult,
    InboundEmailPayload,
    MailboxMessageDetail,
    MailboxMessagesResult,
)
from modules.service.models import SvcEmailIngestLog
from modules.service.service.email_to_ticket_service import EmailToTicketService
from modules.service.service.mailbox_inbox_service import MailboxInboxService
from modules.service.service.mailbox_ticket_classifier import resolved_subject_patterns
from modules.service.service.service_email_parser import parse_service_email_body
from shared.schemas import APIResponse
from pydantic import BaseModel, Field


class EmailParseRequest(BaseModel):
    subject: str | None = None
    body: str = Field(..., min_length=1)


class EmailParseResult(BaseModel):
    subject: str | None = None
    fields: dict


email_inbound_router = APIRouter(prefix="/email-inbound", tags=["Service — Email Inbound"])


def _verify_webhook_secret(x_email_webhook_secret: str | None = Header(default=None)) -> None:
    secret = settings.email_inbound_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Email webhook secret is not configured")
    if x_email_webhook_secret != secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@email_inbound_router.post(
    "/webhook",
    response_model=APIResponse[EmailToTicketResult],
    dependencies=[],
)
def inbound_email_webhook(
    body: InboundEmailPayload,
    db: Annotated[Session, Depends(get_db)],
    x_email_webhook_secret: Annotated[str | None, Header()] = None,
):
    """Public webhook — secured via X-Email-Webhook-Secret header."""
    _verify_webhook_secret(x_email_webhook_secret)
    result = EmailToTicketService(db).process(body, source="webhook")
    db.commit()
    return APIResponse(message=result.message, data=result)


@email_inbound_router.post("/poll-mailbox", response_model=APIResponse[dict])
def poll_support_mailbox_now(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
):
    """Manually poll the configured mailbox (Graph or IMAP) and create tickets."""
    _ = ctx
    if not settings.email_ticket_enabled:
        raise HTTPException(status_code=503, detail="Email-to-ticket automation is disabled")
    if not settings.graph_mail_configured and not settings.imap_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Mailbox not configured. Set MICROSOFT_TENANT_ID/CLIENT_ID/SECRET + "
                "GRAPH_MAILBOX_EMAIL (preferred), or IMAP_* credentials."
            ),
        )
    from modules.service.tasks import poll_support_mailbox

    result = poll_support_mailbox()
    return APIResponse(message="Mailbox poll finished", data=result)


@email_inbound_router.get("/mailbox-messages", response_model=APIResponse[MailboxMessagesResult])
def list_mailbox_messages(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
    top: Annotated[int, Query(ge=1, le=50)] = 50,
):
    """Recent inbox mail for Service Head / Engineer — all messages until subject rules are configured."""
    _ = ctx
    if not settings.graph_mail_configured:
        raise HTTPException(
            status_code=503,
            detail="Graph mailbox not configured. Set MICROSOFT_* / AZURE_* and GRAPH_MAILBOX_EMAIL.",
        )
    try:
        result = MailboxInboxService(db).list_messages(top=top)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return APIResponse(message="OK", data=result)


@email_inbound_router.get("/mailbox-messages/{graph_id}", response_model=APIResponse[MailboxMessageDetail])
def get_mailbox_message(
    graph_id: str,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Full body for one inbox message."""
    _ = ctx
    if not settings.graph_mail_configured:
        raise HTTPException(status_code=503, detail="Graph mailbox not configured.")
    try:
        result = MailboxInboxService(db).get_message(graph_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return APIResponse(message="OK", data=result)


@email_inbound_router.get("/status", response_model=APIResponse[EmailAutomationStatus])
def email_automation_status(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Email automation status — service head / manager only."""
    recent = db.scalar(
        select(func.count()).select_from(SvcEmailIngestLog).where(
            SvcEmailIngestLog.tenant_id == ctx.tenant_id,
        )
    ) or 0
    patterns = resolved_subject_patterns()
    return APIResponse(
        message="OK",
        data=EmailAutomationStatus(
            enabled=settings.email_ticket_enabled,
            smtp_configured=settings.smtp_configured,
            imap_configured=settings.imap_configured,
            graph_configured=settings.graph_mail_configured,
            mailbox=settings.resolved_graph_mailbox() or settings.imap_user or None,
            webhook_path="/api/v1/service/email-inbound/webhook",
            recent_ingests=int(recent),
            subject_patterns=patterns,
            auto_ticket_enabled=bool(patterns),
        ),
    )

@email_inbound_router.post("/parse", response_model=APIResponse[EmailParseResult])
def parse_inbound_email_body(
    body: EmailParseRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:create"))],
):
    """Parse a NOC / carrier email body into ticket field values (no ticket created)."""
    _ = ctx
    fields = parse_service_email_body(body.body, subject=body.subject)
    return APIResponse(
        message="OK",
        data=EmailParseResult(subject=fields.get("subject") or body.subject, fields=fields),
    )
