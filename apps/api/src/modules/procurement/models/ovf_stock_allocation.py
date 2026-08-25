"""OVF demand allocated from on-hand procurement stock units."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.procurement.models.mixins import ProcTransactionMixin


class ProcOvfStockAllocation(Base, *ProcTransactionMixin):
    __tablename__ = "proc_ovf_stock_allocation"
    __table_args__ = (
        UniqueConstraint("stock_unit_id", name="uk_proc_ovf_stock_allocation_unit"),
        {"schema": "procurement"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ovf_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_ovf.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    stock_unit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_inventory_stock_unit.id", ondelete="RESTRICT"),
        nullable=False,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    serial_number: Mapped[str] = mapped_column(String(120), nullable=False)
