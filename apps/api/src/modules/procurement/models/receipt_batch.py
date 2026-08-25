"""Persisted GRN receipt batches per purchase order (for challan / GRN history)."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcOrderReceiptBatch(Base, *ProcTransactionMixin):
    __tablename__ = "proc_order_receipt_batch"
    __table_args__ = (
        UniqueConstraint("order_header_id", "sequence", name="uk_proc_orb_header_seq"),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_header_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    grn_number: Mapped[str] = mapped_column(String(80), nullable=False)
    receipt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    vendor_invoice_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    vendor_invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vendor_invoice_quantity: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    vendor_invoice_subtotal: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    reversal_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="posted", server_default="posted"
    )
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reversed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reversal_reason: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    lines: Mapped[list["ProcOrderReceiptBatchLine"]] = relationship(
        back_populates="receipt_batch",
        cascade="all, delete-orphan",
    )


class ProcOrderReceiptBatchLine(Base, *ProcTransactionMixin):
    __tablename__ = "proc_order_receipt_batch_line"
    __table_args__ = (
        UniqueConstraint(
            "receipt_batch_id",
            "order_line_id",
            name="uk_proc_orbl_batch_line",
        ),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    receipt_batch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_receipt_batch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_line.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    serial_numbers: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    billing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    billing_quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    receipt_batch: Mapped[ProcOrderReceiptBatch] = relationship(back_populates="lines")
