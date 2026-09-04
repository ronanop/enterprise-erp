"""Nested marketing task ORM."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktTask(Base, *MktTransactionMixin):
    __tablename__ = "mkt_task"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','assigned','in_progress','in_review','blocked','completed','cancelled')",
            name="ck_mkt_task_status",
        ),
        CheckConstraint(
            "execution_mode IN ('execute','delegate','hybrid')",
            name="ck_mkt_task_execution_mode",
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
    parent_task_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_task.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    content_request_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_content_request.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    task_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_kind: Mapped[str] = mapped_column(String(40), nullable=False, default="general")
    execution_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="execute")
    complexity: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    estimated_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    actual_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    idle_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    review_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    approval_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_urgent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    owner_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    assignee_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    delegated_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reviewer_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
