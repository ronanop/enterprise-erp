"""Notification ORM models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin


class NtfTemplate(Base, AuditMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "ntf_template"
    __table_args__ = (
        UniqueConstraint("tenant_id", "template_code", "channel", name="uk_ntf_template_code"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_code: Mapped[str] = mapped_column(String(100), nullable=False)
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    subject_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    events: Mapped[list["NtfEvent"]] = relationship(back_populates="template")


class NtfEvent(Base, TenantMixin):
    __tablename__ = "ntf_event"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.ntf_template.id"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    recipient_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    template: Mapped["NtfTemplate"] = relationship(back_populates="events")
    deliveries: Mapped[list["NtfDelivery"]] = relationship(back_populates="event")


class NtfDelivery(Base, TenantMixin):
    __tablename__ = "ntf_delivery"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.ntf_event.id"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="retrying")
    provider_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped["NtfEvent"] = relationship(back_populates="deliveries")
