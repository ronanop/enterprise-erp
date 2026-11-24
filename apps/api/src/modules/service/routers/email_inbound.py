"""Inbound email webhook for automatic service request ticket creation."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from modules.service.dependencies import TenantContext, get_db, get_tenant_context, require_permission
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
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Manually poll the configured mailbox (MailAPI / Graph / IMAP) and create tickets.

    Auth-only: any signed-in user who can open Service Mailbox may trigger poll.
    Ticket creation itself is still gated by EMAIL_TICKET_* settings/filters.
    """
    _ = ctx
    if not settings.email_ticket_enabled:
        raise HTTPException(status_code=503, detail="Email-to-ticket automation is disabled")
    if (
        not settings.mailapi_configured
        and not settings.graph_mail_configured
        and not settings.imap_configured
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Mailbox not configured. Set MAILAPI_ENABLED/BASE_URL/API_KEY (preferred), "
                "or MICROSOFT_* + GRAPH_MAILBOX_EMAIL, or IMAP_* credentials."
            ),
        )
    from modules.service.tasks import poll_support_mailbox

    result = poll_support_mailbox()
    if result.get("status") == "error":
        raise HTTPException(
            status_code=503,
            detail=str(result.get("reason") or "Mailbox poll failed"),
        )
    return APIResponse(message="Mailbox poll finished", data=result)


@email_inbound_router.get("/mailbox-messages", response_model=APIResponse[MailboxMessagesResult])
def list_mailbox_messages(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    top: Annotated[int, Query(ge=1, le=50)] = 50,
    poll: Annotated[bool, Query()] = False,
):
    """Recent inbox mail for Service Head / Engineer (MailAPI or Graph).

    Pass poll=true to auto-create tickets from subjects containing \"ticket\"
    before returning the inbox (no separate POST needed).
    """
    _ = ctx

    poll_summary: str | None = None
    if (
        poll
        and settings.email_ticket_enabled
        and (settings.mailapi_configured or settings.graph_mail_configured)
    ):
        from modules.service.tasks import poll_support_mailbox

        poll_result = poll_support_mailbox()
        if poll_result.get("status") == "ok":
            poll_summary = (
                f"Poll: {poll_result.get('processed', 0)} ticket(s) created, "
                f"{poll_result.get('skipped', 0)} skipped, "
                f"{poll_result.get('errors', 0)} error(s)."
            )
        elif poll_result.get("status") == "error":
            poll_summary = f"Poll: {poll_result.get('reason') or 'failed'}"
        else:
            poll_summary = f"Poll: {poll_result.get('reason') or poll_result.get('status')}"

    try:
        result = MailboxInboxService(db).list_messages(top=top)
    except RuntimeError as exc:
        result = MailboxInboxService(db)._offline_result(str(exc))
    except Exception as exc:
        result = MailboxInboxService(db)._offline_result(
            f"Mailbox unavailable: {exc}. "
            "Configure MAILAPI_* or Graph credentials, then Refresh."
        )
    result.poll_summary = poll_summary
    return APIResponse(message="OK", data=result)


@email_inbound_router.get("/mailbox-messages/{graph_id}", response_model=APIResponse[MailboxMessageDetail])
def get_mailbox_message(
    graph_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    """Full body for one inbox message."""
    _ = ctx
    if not settings.mailapi_configured and not settings.graph_mail_configured:
        raise HTTPException(status_code=503, detail="Mailbox not configured.")
    try:
        result = MailboxInboxService(db).get_message(graph_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Mailbox message unavailable: {exc}",
        ) from exc
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
    mailbox = settings.resolved_support_mailbox() or settings.imap_user or None
    return APIResponse(
        message="OK",
        data=EmailAutomationStatus(
            enabled=settings.email_ticket_enabled,
            smtp_configured=settings.smtp_configured,
            imap_configured=settings.imap_configured,
            graph_configured=settings.graph_mail_configured,
            mailapi_configured=settings.mailapi_configured,
            mailbox=mailbox,
            webhook_path="/api/v1/service/email-inbound/webhook",
            recent_ingests=int(recent),
            subject_patterns=patterns,
            auto_ticket_enabled=bool(patterns) or settings.email_ticket_accept_all,
            accept_all=bool(settings.email_ticket_accept_all),
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
