"""PO queue handoff — Installation share to Projects PO Queue (server-side)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.project.models.mixins import PrjTransactionMixin


class PrjPoQueueHandoff(Base, *PrjTransactionMixin):
    __tablename__ = "prj_po_queue_handoff"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "proc_order_id",
            name="uk_prj_po_queue_handoff_order",
        ),
        {"schema": "project"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    proc_order_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("procurement.proc_order_header.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    challan_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    circle_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    site_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rack_quantity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    server_quantity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    server_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
