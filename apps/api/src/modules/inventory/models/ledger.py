"""Inventory stock ledger ORM model - append-only."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.inventory.models.mixins import InvLedgerMixin


class InvStockLedger(Base, *InvLedgerMixin):
    __tablename__ = "inv_stock_ledger"
    __table_args__ = (
        UniqueConstraint("company_id", "entry_number", name="uk_inv_sl_company_entry"),
        CheckConstraint("quantity_in >= 0", name="ck_inv_sl_qty_in"),
        CheckConstraint("quantity_out >= 0", name="ck_inv_sl_qty_out"),
        CheckConstraint(
            "movement_type IN ("
            "'receipt','issue','transfer_out','transfer_in',"
            "'adjustment_in','adjustment_out','return_in','return_out',"
            "'count_gain','count_loss')"
            ,
            name="ck_inv_sl_movement",
        ),
        Index(
            "ix_inv_sl_wh_product_posted",
            "warehouse_id",
            "product_id",
            "posted_at",
        ),
        Index(
            "ix_inv_sl_source",
            "source_module",
            "source_document_type",
            "source_document_id",
        ),
        {"schema": "inventory"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_number: Mapped[str] = mapped_column(String(50), nullable=False)
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    posted_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="RESTRICT"),
        nullable=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    warehouse_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_warehouse.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    uom_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_uom.id", ondelete="RESTRICT"),
        nullable=False,
    )
    bin_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("inventory.inv_bin.id", ondelete="RESTRICT"),
        nullable=True,
    )
    batch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("inventory.inv_batch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    serial_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("inventory.inv_serial.id", ondelete="RESTRICT"),
        nullable=True,
    )
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    quantity_in: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    quantity_out: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    total_cost: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    source_module: Mapped[str] = mapped_column(String(50), nullable=False)
    source_document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_document_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    source_line_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reversal_of_ledger_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("inventory.inv_stock_ledger.id", ondelete="RESTRICT"),
        nullable=True,
    )
    finance_journal_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_journal_header.id", ondelete="RESTRICT"),
        nullable=True,
    )
