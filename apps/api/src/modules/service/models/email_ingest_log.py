"""Audit log for inbound emails processed into service request tickets."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class SvcEmailIngestLog(Base):
    __tablename__ = "svc_email_ingest_log"
    __table_args__ = (
        UniqueConstraint("message_id", name="uk_svc_email_ingest_message_id"),
        CheckConstraint(
            "status IN ('processed','duplicate','failed','skipped')",
            name="ck_svc_email_ingest_status",
        ),
        {"schema": "service"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    message_id: Mapped[str] = mapped_column(String(512), nullable=False)
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="processed")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="webhook")
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
