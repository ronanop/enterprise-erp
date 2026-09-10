"""Quality recall campaign ORM — scope/campaign; CAPA remains the action plan.

v1 stores an affected VIN range (vin_from / vin_to). An explicit per-VIN
child table (qm_recall_vin) is a possible future addition if the business
needs a list rather than a range.
"""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmRecall(Base, *QmTransactionMixin):
    __tablename__ = "qm_recall"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_rcl_company_number"),
        CheckConstraint(
            "status IN ('draft','announced','in_progress','closed','cancelled')",
            name="ck_qm_rcl_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    trigger_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    vin_from: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    vin_to: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    capa_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_capa.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    ncr_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_ncr.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    warranty_claim_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_warranty_claim.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
