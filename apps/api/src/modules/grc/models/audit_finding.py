"""Audit finding ORM per ERD_19 section 6.15."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcAuditFinding(Base, *GrcTransactionMixin):
    __tablename__ = "grc_audit_finding"
    __table_args__ = (
        UniqueConstraint("company_id", "finding_number", name="uk_grc_audit_finding_number"),
        CheckConstraint(
            "severity IN ('observation','minor','major','critical')",
            name="ck_grc_finding_severity",
        ),
        CheckConstraint(
            "status IN ('open','in_remediation','closed','accepted')",
            name="ck_grc_audit_finding_status",
        ),
        Index("ix_grc_finding_severity", "severity"),
        Index("ix_grc_finding_due_date", "due_date"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    finding_number: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_required: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
