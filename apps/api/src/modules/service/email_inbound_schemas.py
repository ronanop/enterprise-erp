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
    graph_configured: bool = False
    mailbox: str | None = None
    webhook_path: str
    recent_ingests: int = 0
    subject_patterns: list[str] = Field(default_factory=list)
    auto_ticket_enabled: bool = False


class MailboxMessageItem(BaseModel):
    graph_id: str
    message_id: str
    internet_message_id: str | None = None
    from_address: str
    from_name: str | None = None
    subject: str
    body_preview: str = ""
    received_at: datetime | None = None
    is_read: bool = False
    classification: str = "review"
    ingest_status: str | None = None
    ticket_id: UUID | None = None
    document_number: str | None = None
    ticket_status: str | None = None
    opened_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None


class MailboxMessageDetail(MailboxMessageItem):
    body_text: str | None = None
    body_html: str | None = None


class MailboxMessagesResult(BaseModel):
    mailbox: str
    total: int
    subject_patterns: list[str] = Field(default_factory=list)
    messages: list[MailboxMessageItem] = Field(default_factory=list)
