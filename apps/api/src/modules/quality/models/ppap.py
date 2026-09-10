"""Quality PPAP ORM."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmPpap(Base, *QmTransactionMixin):
    __tablename__ = "qm_ppap"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_ppap_company_number"),
        CheckConstraint(
            "submission_level IN ('1','2','3','4','5')",
            name="ck_qm_ppap_level",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','interim')",
            name="ck_qm_ppap_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vendor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    submission_level: Mapped[str] = mapped_column(String(1), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    inspection_plan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    pfmea_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_pfmea.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="RESTRICT"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
