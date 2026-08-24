"""Content request ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktContentRequest(Base, *MktTransactionMixin):
    __tablename__ = "mkt_content_request"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','queued','processing','completed','failed','cancelled')",
            name="ck_mkt_content_request_status",
        ),
        CheckConstraint(
            "content_type IN ('post','thread','blog','newsletter','script','ad','carousel','other')",
            name="ck_mkt_content_request_type",
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
    campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    platform_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_platform.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    brand_voice_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_brand_voice.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pillar_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_content_pillar.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    request_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(30), nullable=False, default="post")
    audience: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language_code: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    goal: Mapped[str | None] = mapped_column(String(255), nullable=True)
    inputs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
