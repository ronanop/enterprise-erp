"""Manual / Excel-imported procurement inventory lines (optional PO link)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcInventoryImportLine(Base, *ProcTransactionMixin):
    __tablename__ = "proc_inventory_import_line"
    __table_args__ = {"schema": "procurement"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[str] = mapped_column(String(120), nullable=False)
    warranty_valid_till: Mapped[date | None] = mapped_column(Date, nullable=True)
    order_header_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    company_po_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Legacy stock migration: purchase cost and original receipt date drive aging.
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    received_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Manual / Excel commercial columns (aligned with inventory ledger headings).
    vendor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendor_invoice_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    vendor_invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    part_no: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sales_spoc: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payment_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_ovf_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    open_for_sale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    open_for_sale_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
