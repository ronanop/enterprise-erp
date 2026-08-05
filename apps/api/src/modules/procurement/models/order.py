"""Procurement purchase order ORM models."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcOrderHeader(Base, *ProcTransactionMixin):
    __tablename__ = "proc_order_header"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_proc_oh_company_number"),
        CheckConstraint(
            "status IN "
            "('draft','submitted','approved','sent','partially_received','received','closed','cancelled')",
            name="ck_proc_oh_status",
        ),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vendor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requisition_header_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_requisition_header.id", ondelete="RESTRICT"),
        nullable=True,
    )
    rfq_header_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_rfq_header.id", ondelete="RESTRICT"),
        nullable=True,
    )
    vendor_quotation_header_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_vendor_quotation_header.id", ondelete="RESTRICT"),
        nullable=True,
    )
    # Logical FK to proc_vendor_contract — DB constraint added in migration 0069
    # (contracts are created after orders per ERD migration order).
    contract_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    payment_terms: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False)
    exchange_rate: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False, default=1)
    subtotal_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    received_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    invoiced_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="RESTRICT"),
        nullable=True,
    )
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    # Entity-based company PO number, e.g. PO/CDT/001 (assigned on finalize).
    company_po_number: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    entity_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Groups receipt saves so GRN PDF shows only the latest receipt batch.
    current_receipt_batch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    current_receipt_batch_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Sequential GRN docs per PO: PO/CDT/002/001, /002, …
    grn_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    current_grn_number: Mapped[str | None] = mapped_column(String(80), nullable=True)

    lines: Mapped[list["ProcOrderLine"]] = relationship(
        back_populates="order_header",
        cascade="all, delete-orphan",
    )


class ProcOrderLine(Base, *ProcTransactionMixin):
    __tablename__ = "proc_order_line"
    __table_args__ = (
        UniqueConstraint("order_header_id", "line_number", name="uk_proc_ol_header_line"),
        CheckConstraint("quantity > 0", name="ck_proc_ol_qty"),
        CheckConstraint("unit_cost > 0", name="ck_proc_ol_unit_cost"),
        CheckConstraint(
            "status IN ('open','partially_received','received','closed','cancelled')",
            name="ck_proc_ol_status",
        ),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    order_header_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
    )
    product_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    product_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    uom_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_uom.id", ondelete="RESTRICT"),
        nullable=False,
    )
    unit_cost: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    tax_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_tax.id", ondelete="RESTRICT"),
        nullable=True,
    )
    tax_rate: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    quantity_received: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    quantity_invoiced: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    quantity_returned: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    # Qty recorded in the most recent receipt save for this line (GRN PDF uses this).
    last_receipt_qty: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    last_receipt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_receipt_batch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    # One entry per unit in last_receipt_qty (use "NA" when not tracked).
    last_receipt_serial_numbers: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    order_header: Mapped[ProcOrderHeader] = relationship(back_populates="lines")
