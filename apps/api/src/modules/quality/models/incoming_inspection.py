"""Quality incoming inspection ORM."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin, QmTxnLineMixin


class QmIncomingInspection(Base, *QmTransactionMixin):
    __tablename__ = "qm_incoming_inspection"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_iqc_company_number"),
        CheckConstraint("inspected_qty >= 0", name="ck_qm_iqc_inspected"),
        CheckConstraint("accepted_qty >= 0 AND rejected_qty >= 0", name="ck_qm_iqc_disp"),
        CheckConstraint(
            "result IN ('pending','accepted','rejected','conditional')",
            name="ck_qm_iqc_result",
        ),
        CheckConstraint(
            "status IN ('draft','in_progress','completed','cancelled')",
            name="ck_qm_iqc_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    warehouse_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_warehouse.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    inspection_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=True,
    )
    vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    uom_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_uom.id", ondelete="RESTRICT"),
        nullable=False,
    )
    inspected_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    accepted_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    rejected_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="RESTRICT"),
        nullable=True,
    )
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    source_line_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inspector_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    inspected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inventory_event_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    period_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_period.id", ondelete="RESTRICT"),
        nullable=True,
    )
    finance_journal_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_journal_header.id", ondelete="RESTRICT"),
        nullable=True,
    )

    lines: Mapped[list["QmIncomingInspectionLine"]] = relationship(
        back_populates="incoming_inspection", cascade="all, delete-orphan"
    )


class QmIncomingInspectionLine(Base, *QmTxnLineMixin):
    __tablename__ = "qm_incoming_inspection_line"
    __table_args__ = (
        UniqueConstraint("incoming_inspection_id", "line_number", name="uk_qm_iqc_line"),
        CheckConstraint(
            "pass_fail IN ('pass','fail','na') OR pass_fail IS NULL",
            name="ck_qm_iqc_line_pf",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    incoming_inspection_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_incoming_inspection.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    line_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    characteristic_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_quality_characteristic.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    measured_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    measured_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pass_fail: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_out_of_spec: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    defect_type_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_defect_type.id", ondelete="RESTRICT"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")

    incoming_inspection: Mapped[QmIncomingInspection] = relationship(back_populates="lines")
