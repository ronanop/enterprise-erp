"""Accounts invoice generation tasks created from Billing GRN disposition."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcInvoiceGenerationTask(Base, *ProcTransactionMixin):
    __tablename__ = "proc_invoice_generation_task"
    # Active-row uniqueness is enforced by partial index
    # uk_proc_igt_tenant_batch_assignee (WHERE is_deleted = false).
    __table_args__ = ({"schema": "procurement"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    order_header_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    receipt_batch_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    grn_number: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    purchase_order_number: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    items_summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    assigned_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    requested_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    invoice_quantity: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    invoice_amount: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
