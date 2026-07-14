"""Quality in-process inspection ORM."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin


class QmInprocessInspection(Base, *QmTransactionMixin):
    __tablename__ = "qm_inprocess_inspection"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_ipqc_company_number"),
        CheckConstraint(
            "result IN ('pending','accepted','rejected','rework_required')",
            name="ck_qm_ipqc_result",
        ),
        CheckConstraint(
            "status IN ('draft','completed','cancelled')",
            name="ck_qm_ipqc_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    production_order_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    production_operation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    operation_seq: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    inspection_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=True,
    )
    inspector_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True, default="manufacturing")
    source_document_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
