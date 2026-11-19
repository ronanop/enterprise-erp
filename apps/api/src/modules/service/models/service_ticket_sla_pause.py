"""Append-only SLA pause intervals for a service request ticket."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class SvcTicketSlaPause(Base):
    """One row per pause interval; resumed_at NULL means currently paused."""

    __tablename__ = "svc_ticket_sla_pause"
    __table_args__ = ({"schema": "service"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    paused_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    resume_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    paused_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    resumed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
