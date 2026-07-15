"""Compliance assessment ORM per ERD_19 section 6.12."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcComplianceAssessment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_compliance_assessment"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "assessment_number",
            name="uk_grc_compliance_assessment_number",
        ),
        CheckConstraint(
            "compliance_status IN ('compliant','partially_compliant','non_compliant')",
            name="ck_grc_compliance_status",
        ),
        CheckConstraint(
            "status IN ('draft','completed','overdue','archived')",
            name="ck_grc_compliance_assessment_status",
        ),
        Index("ix_grc_compliance_status_col", "compliance_status"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    requirement_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_compliance_requirement.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assessment_number: Mapped[str] = mapped_column(String(50), nullable=False)

    assessed_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    compliance_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    evidence_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    next_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
