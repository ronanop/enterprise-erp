"""Negative inventory ledger entries created when a GRN receipt batch is reversed."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcInventoryStockAdjustment(Base, *ProcTransactionMixin):
    __tablename__ = "proc_inventory_stock_adjustment"
    __table_args__ = {"schema": "procurement"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    receipt_batch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_receipt_batch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_header_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_line.id", ondelete="RESTRICT"),
        nullable=False,
    )
    stock_unit_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_inventory_stock_unit.id", ondelete="RESTRICT"),
        nullable=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    grn_number: Mapped[str] = mapped_column(String(80), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_index: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    reason: Mapped[str] = mapped_column(String(2000), nullable=False)
