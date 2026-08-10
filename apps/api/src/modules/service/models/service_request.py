"""Service request ORM per ERD_16 section 6.2."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.service.models.mixins import SvcTransactionMixin


class SvcServiceRequest(Base, *SvcTransactionMixin):
    __tablename__ = "svc_service_request"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_svc_service_request_doc"),
        CheckConstraint(
            "service_type IN ('preventive','corrective','breakdown','installation','inspection','other',"
            "'managed_services','hardware','software','network')",
            name="ck_svc_service_request_type",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','critical','p1','p2','p3','p4')",
            name="ck_svc_service_request_priority",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','new','ticket_registered','assigned',"
            "'in_progress','engineer_working','pending_customer','pending_oem',"
            "'resolved','closed','cancelled')",
            name="ck_svc_service_request_status",
        ),
        CheckConstraint(
            "sla_status IS NULL OR sla_status IN ('within_sla','at_risk','breached')",
            name="ck_svc_service_request_sla_status",
        ),
        {"schema": "service"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requested_by_employee_id: Mapped[UUID | None] = mapped_column(
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
    contract_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "service.svc_service_contract.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_svc_request_contract",
        ),
        nullable=True,
        index=True,
    )
    service_type: Mapped[str] = mapped_column(String(40), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    master_asset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_asset.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    asset_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    maintenance_plan_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_customer_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "service.svc_service_sla.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_svc_request_sla",
        ),
        nullable=True,
        index=True,
    )
    sla_status: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

    # SOP — Basic Information
    mode_of_action: Mapped[str | None] = mapped_column(String(40), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    alternate_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)

    # SOP — Ticket Information
    ticket_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    software_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issue_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SOP — Reference
    reference_sr_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lsi: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # SOP — End Customer
    end_customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    end_customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    coordinator_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    coordinator_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    end_customer_street: Mapped[str | None] = mapped_column(String(500), nullable=True)
    end_customer_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    end_customer_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    end_customer_city_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    end_customer_other_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    end_customer_gst: Mapped[str | None] = mapped_column(String(50), nullable=True)
    end_customer_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # SOP — Additional
    start_work_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    classification: Mapped[str | None] = mapped_column(String(50), nullable=True)
    escalation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    oem_support_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # SOP — Asset snapshot
    asset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    warranty_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    warranty_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amc_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    asset_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    amc_mail_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Ownership workflow — solution & lifecycle
    solution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ownership_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Owner must explicitly open ticket — SLA clock starts here
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    sla_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

