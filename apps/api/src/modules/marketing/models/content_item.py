"""Marketing content item model."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.domain.enums import ContentStatus, ContentType
from modules.marketing.models.mixins import MktTransactionMixin


class MktContentItem(Base, *MktTransactionMixin):
    __tablename__ = "mkt_content_item"
    __table_args__ = {"schema": "marketing"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    content_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default=ContentType.SOCIAL_POST.value)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=ContentStatus.DRAFT.value)
    campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id"),
        nullable=True,
    )
    channel_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_channel.id"),
        nullable=True,
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    call_to_action: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    hashtags: Mapped[str | None] = mapped_column(String(500), nullable=True)
    theme: Mapped[str | None] = mapped_column(String(255), nullable=True)
    font_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    font_size: Mapped[str | None] = mapped_column(String(60), nullable=True)
    color_codes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    workflow_stage: Mapped[str | None] = mapped_column(String(40), nullable=True)
    final_head_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    assigned_to_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    approved_by_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    published_by_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    posting_report_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    posting_report_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    posting_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posting_reported_by_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
