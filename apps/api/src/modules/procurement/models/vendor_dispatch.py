"""Vendor dispatch waves recorded before GRN on CRM purchase orders."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcVendorDispatch(Base, *ProcTransactionMixin):
    __tablename__ = "proc_vendor_dispatch"
    __table_args__ = (
        UniqueConstraint("order_header_id", "sequence", name="uk_proc_vd_header_seq"),
        CheckConstraint(
            "status IN ('recorded', 'grn_done', 'cancelled')",
            name="ck_proc_vd_status",
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
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    dc_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    lr_awb_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dispatch_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    eway_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    transport_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_refs: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="recorded", server_default="recorded"
    )

    lines: Mapped[list["ProcVendorDispatchLine"]] = relationship(
        back_populates="dispatch",
        cascade="all, delete-orphan",
    )


class ProcVendorDispatchLine(Base, *ProcTransactionMixin):
    __tablename__ = "proc_vendor_dispatch_line"
    __table_args__ = (
        UniqueConstraint(
            "dispatch_id",
            "order_line_id",
            name="uk_proc_vdl_dispatch_line",
        ),
        CheckConstraint("dispatch_qty > 0", name="ck_proc_vdl_qty"),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dispatch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_vendor_dispatch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_line.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    dispatch_qty: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)

    dispatch: Mapped[ProcVendorDispatch] = relationship(back_populates="lines")
