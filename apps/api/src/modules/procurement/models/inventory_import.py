"""Manual / Excel-imported procurement inventory lines (optional PO link)."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcInventoryImportLine(Base, *ProcTransactionMixin):
    __tablename__ = "proc_inventory_import_line"
    __table_args__ = {"schema": "procurement"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(120), nullable=False)
    order_header_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    company_po_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
