"""Quality warranty claim ORM — independent of customer complaints."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmWarrantyClaim(Base, *QmTransactionMixin):
    __tablename__ = "qm_warranty_claim"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_wrn_company_number"),
        CheckConstraint(
            "claim_type IN ("
            "'field_failure','part_replacement','goodwill','campaign','other')",
            name="ck_qm_wrn_type",
        ),
        CheckConstraint(
            "status IN ("
            "'draft','investigating','accepted','rejected','capa_linked','closed','cancelled')",
            name="ck_qm_wrn_status",
        ),
        CheckConstraint("quantity >= 0", name="ck_qm_wrn_qty"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vin_trace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_vin_trace.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    component_product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    claim_type: Mapped[str] = mapped_column(String(30), nullable=False, default="field_failure")
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
    customer_complaint_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_customer_complaint.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
