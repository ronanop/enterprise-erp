"""Quality VIN traceability ORM."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin, QmTxnLineMixin


class QmVinTrace(Base, *QmTransactionMixin):
    __tablename__ = "qm_vin_trace"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_vin_company_number"),
        UniqueConstraint("company_id", "vin", name="uk_qm_vin_company_vin"),
        CheckConstraint(
            "status IN ('built','inspected','shipped')",
            name="ck_qm_vin_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vin: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    final_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_final_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="built", index=True)

    components: Mapped[list[QmVinTraceComponent]] = relationship(
        back_populates="vin_trace", cascade="all, delete-orphan"
    )


class QmVinTraceComponent(Base, *QmTxnLineMixin):
    __tablename__ = "qm_vin_trace_component"
    __table_args__ = (
        UniqueConstraint("vin_trace_id", "line_number", name="uk_qm_vin_comp_line"),
        CheckConstraint("quantity >= 0", name="ck_qm_vin_comp_qty"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    vin_trace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_vin_trace.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    vin_trace: Mapped[QmVinTrace] = relationship(back_populates="components")
