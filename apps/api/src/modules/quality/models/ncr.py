"""Quality NCR ORM."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmNcr(Base, *QmTransactionMixin):
    __tablename__ = "qm_ncr"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_ncr_company_number"),
        CheckConstraint(
            "source IN ('incoming','in_process','final','audit','complaint','supplier','other')",
            name="ck_qm_ncr_source",
        ),
        CheckConstraint(
            "severity IN ('minor','major','critical')",
            name="ck_qm_ncr_severity",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','closed','cancelled')",
            name="ck_qm_ncr_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="minor")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=True,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="RESTRICT"),
        nullable=True,
    )
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    incoming_inspection_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inprocess_inspection_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    final_inspection_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
