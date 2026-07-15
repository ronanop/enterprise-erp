"""Audit ORM per ERD_19 section 6.14."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcAudit(Base, *GrcTransactionMixin):
    __tablename__ = "grc_audit"
    __table_args__ = (
        UniqueConstraint("company_id", "audit_number", name="uk_grc_audit_number"),
        CheckConstraint(
            "audit_type IN ('internal','external','compliance','financial','operational','it')",
            name="ck_grc_audit_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','planned','in_progress',"
            "'completed','closed','cancelled')",
            name="ck_grc_audit_status",
        ),
        Index("ix_grc_audit_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_number: Mapped[str] = mapped_column(String(50), nullable=False)
    audit_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_audit_plan.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    audit_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    lead_auditor_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    planned_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    quality_nonconformance_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

