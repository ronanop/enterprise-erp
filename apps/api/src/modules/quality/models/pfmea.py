"""Quality PFMEA ORM models."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmLineMixin, QmMasterMixin


class QmPfmea(Base, *QmMasterMixin):
    __tablename__ = "qm_pfmea"
    __table_args__ = (
        UniqueConstraint("company_id", "pfmea_code", name="uk_qm_pfmea_company_code"),
        CheckConstraint(
            "status IN ('draft','active','obsolete')",
            name="ck_qm_pfmea_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    pfmea_code: Mapped[str] = mapped_column(String(50), nullable=False)
    pfmea_name: Mapped[str] = mapped_column(String(255), nullable=False)
    inspection_plan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    process_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    revision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list[QmPfmeaLine]] = relationship(
        back_populates="pfmea", cascade="all, delete-orphan"
    )


class QmPfmeaLine(Base, *QmLineMixin):
    __tablename__ = "qm_pfmea_line"
    __table_args__ = (
        UniqueConstraint("pfmea_id", "sequence_no", name="uk_qm_pfmea_line_seq"),
        CheckConstraint("severity >= 1 AND severity <= 10", name="ck_qm_pfmea_line_sev"),
        CheckConstraint("occurrence >= 1 AND occurrence <= 10", name="ck_qm_pfmea_line_occ"),
        CheckConstraint("detection >= 1 AND detection <= 10", name="ck_qm_pfmea_line_det"),
        CheckConstraint("rpn >= 1 AND rpn <= 1000", name="ck_qm_pfmea_line_rpn"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    pfmea_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_pfmea.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    process_step: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_mode: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_effect: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    occurrence: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    detection: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rpn: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    characteristic_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_quality_characteristic.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    pfmea: Mapped[QmPfmea] = relationship(back_populates="lines")
