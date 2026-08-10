"""Schemas for inbound email → service request ticket automation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InboundEmailPayload(BaseModel):
    """Generic inbound email payload (webhook or manual test)."""

    message_id: str = Field(..., min_length=1, max_length=512)
    from_address: str = Field(..., min_length=3, max_length=255)
    from_name: str | None = None
    to_address: str | None = None
    subject: str = Field(default="(No subject)", max_length=500)
    body_text: str | None = None
    body_html: str | None = None
    received_at: datetime | None = None


class EmailToTicketResult(BaseModel):
    status: str
    message: str
    ticket_id: UUID | None = None
    document_number: str | None = None
    ingest_log_id: UUID | None = None


class EmailAutomationStatus(BaseModel):
    enabled: bool
    smtp_configured: bool
    imap_configured: bool
    webhook_path: str
    recent_ingests: int = 0
