"""Publish job ORM."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktPublishJob(Base, *MktTransactionMixin):
    __tablename__ = "mkt_publish_job"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','queued','running','succeeded','failed','cancelled')",
            name="ck_mkt_publish_job_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    calendar_entry_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_calendar_entry.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    content_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_generated_content.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    social_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_social_account.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    platform_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_platform.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
