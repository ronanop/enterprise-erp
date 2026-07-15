"""Corrective action ORM per ERD_19 section 6.16."""

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


class GrcCorrectiveAction(Base, *GrcTransactionMixin):
    __tablename__ = "grc_corrective_action"
    __table_args__ = (
        UniqueConstraint("company_id", "capa_number", name="uk_grc_corrective_action_number"),
        CheckConstraint(
            "effectiveness_result IS NULL OR effectiveness_result IN "
            "('effective','ineffective','pending')",
            name="ck_grc_capa_effectiveness",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','open','in_progress',"
            "'completed','verified','cancelled')",
            name="ck_grc_corrective_action_status",
        ),
        Index("ix_grc_capa_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_capa_due_date", "due_date"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    capa_number: Mapped[str] = mapped_column(String(50), nullable=False)
    finding_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit_finding.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    incident_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "grc.grc_incident.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_grc_capa_incident",
        ),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effectiveness_result: Mapped[str | None] = mapped_column(String(30), nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    quality_nonconformance_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    helpdesk_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

