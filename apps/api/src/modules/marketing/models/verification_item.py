"""Individual checklist item within a verifier's review."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.domain.enums import VerificationItemStatus
from modules.marketing.models.mixins import MktDetailMixin


class MktVerificationItem(Base, *MktDetailMixin):
    __tablename__ = "mkt_verification_item"
    __table_args__ = (
        UniqueConstraint("verification_id", "item_key", name="uq_mkt_verification_item_key"),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    verification_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_content_verification.id"),
        nullable=False,
    )
    item_key: Mapped[str] = mapped_column(String(60), nullable=False)
    item_label: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=VerificationItemStatus.PENDING.value)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_to_head_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reviewed_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
