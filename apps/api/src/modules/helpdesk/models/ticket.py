"""Ticket ORM per ERD_17 section 6.3."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicket(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_doc"),
        CheckConstraint(
            "ticket_type IN ('incident','service_request','problem','change')",
            name="ck_hd_ticket_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','new','assigned','in_progress',"
            "'pending','resolved','closed','cancelled')",
            name="ck_hd_ticket_status",
        ),
        # Distinct from hd_ticket_sla.status index name collision
        Index("ix_hd_ticket_sla_status_val", "sla_status"),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    priority_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_priority.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    ticket_type: Mapped[str] = mapped_column(String(40), nullable=False)
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    requester_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    support_team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_support_team.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_ticket_support_team",
        ),
        nullable=True,
        index=True,
    )
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_sla.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_ticket_sla",
        ),
        nullable=True,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    impact: Mapped[str | None] = mapped_column(String(20), nullable=True)
    urgency: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sla_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_shared_queue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    service_request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    service_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    work_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_customer_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    asset_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inventory_issue_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    quality_case_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
