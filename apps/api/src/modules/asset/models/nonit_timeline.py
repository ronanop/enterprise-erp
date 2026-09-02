"""Append-only Non-IT asset timeline events."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class AstNonitAssetTimeline(Base):
    """No soft-delete / update API — append-only audit trail."""

    __tablename__ = "ast_nonit_asset_timeline"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ("
            "'CREATED','ASSIGNED','UNASSIGNED','LOCATION_CHANGED',"
            "'STATUS_CHANGED','MAINTENANCE_STARTED','MAINTENANCE_COMPLETED',"
            "'DISPOSED','IMPORTED'"
            ")",
            name="ck_ast_nonit_asset_timeline_event_type",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_nonit_asset.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    event_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
