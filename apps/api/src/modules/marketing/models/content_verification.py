"""Per-verifier content verification record."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.domain.enums import VerificationOverallStatus, VerifierRole
from modules.marketing.models.mixins import MktDetailMixin


class MktContentVerification(Base, *MktDetailMixin):
    __tablename__ = "mkt_content_verification"
    __table_args__ = (
        UniqueConstraint("content_item_id", "verifier_role", name="uq_mkt_content_verification_role"),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    content_item_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_content_item.id"),
        nullable=False,
    )
    verifier_role: Mapped[str] = mapped_column(String(40), nullable=False, default=VerifierRole.CREATOR.value)
    verifier_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    overall_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=VerificationOverallStatus.PENDING.value
    )
    overall_comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    posting_planned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posting_timeline_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    posting_confirmed: Mapped[bool | None] = mapped_column(nullable=True)
    sent_to_publisher_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publisher_upload_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    publisher_upload_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    publisher_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
