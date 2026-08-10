"""Inbound email webhook for automatic service request ticket creation."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from modules.service.dependencies import TenantContext, get_db, get_tenant_context, require_permission
from modules.service.email_inbound_schemas import (
    EmailAutomationStatus,
    EmailToTicketResult,
    InboundEmailPayload,
)
from modules.service.models import SvcEmailIngestLog
from modules.service.service.email_to_ticket_service import EmailToTicketService
from shared.schemas import APIResponse

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


@email_inbound_router.post("/test", response_model=APIResponse[EmailToTicketResult])
def test_inbound_email(
    body: InboundEmailPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Authenticated test endpoint to simulate an inbound email."""
    _ = ctx
    result = EmailToTicketService(db).process(body, source="manual_test")
    db.commit()
    return APIResponse(message=result.message, data=result)


@email_inbound_router.get("/status", response_model=APIResponse[EmailAutomationStatus])
def email_automation_status(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    recent = db.scalar(
        select(func.count()).select_from(SvcEmailIngestLog).where(
            SvcEmailIngestLog.tenant_id == ctx.tenant_id,
        )
    ) or 0
    return APIResponse(
        message="OK",
        data=EmailAutomationStatus(
            enabled=settings.email_ticket_enabled,
            smtp_configured=settings.smtp_configured,
            imap_configured=settings.imap_configured,
            webhook_path="/api/v1/service/email-inbound/webhook",
            recent_ingests=int(recent),
        ),
    )
