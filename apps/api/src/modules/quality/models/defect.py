"""Quality defect ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmDefect(Base, *QmTransactionMixin):
    __tablename__ = "qm_defect"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_qm_def_qty"),
        CheckConstraint(
            "severity IN ('minor','major','critical')",
            name="ck_qm_def_severity",
        ),
        CheckConstraint(
            "source_inspection_type IN ("
            "'incoming','in_process','final','audit','complaint','other')",
            name="ck_qm_def_source",
        ),
        CheckConstraint(
            "status IN ('open','linked_to_ncr','closed')",
            name="ck_qm_def_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    defect_type_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_defect_type.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="minor")
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_inspection_type: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    incoming_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_incoming_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    inprocess_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inprocess_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    final_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_final_inspection.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    ncr_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
