"""Quality SPC reading ORM."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmSpcReading(Base, *QmTransactionMixin):
    __tablename__ = "qm_spc_reading"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_spc_company_number"),
        CheckConstraint(
            "source_inspection_type IN ("
            "'incoming','in_process','final','audit','complaint','other') "
            "OR source_inspection_type IS NULL",
            name="ck_qm_spc_source",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    characteristic_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_quality_characteristic.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    inspection_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    measured_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    source_inspection_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    incoming_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_incoming_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    inprocess_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inprocess_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    final_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_final_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    is_out_of_control: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    ncr_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
