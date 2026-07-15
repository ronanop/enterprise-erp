"""Data snapshot ORM per ERD_20 section 6.12."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataSnapshot(Base, *BiRowMixin):
    __tablename__ = "bi_data_snapshot"
    __table_args__ = (
        UniqueConstraint("company_id", "snapshot_number", name="uk_bi_data_snapshot_number"),
        CheckConstraint(
            "status IN ('ready','expired','failed')",
            name="ck_bi_data_snapshot_status",
        ),
        CheckConstraint("row_count IS NULL OR row_count >= 0", name="ck_bi_snapshot_row_count"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    snapshot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    snapshot_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)

    refresh_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_data_refresh.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_snapshot_refresh",
        ),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ready", index=True)
