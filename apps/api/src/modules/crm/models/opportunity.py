"""CRM opportunity ORM."""

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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmOpportunity(Base, *CrmTransactionMixin):
    __tablename__ = "crm_opportunity"
    __table_args__ = (
        UniqueConstraint("company_id", "opportunity_code", name="uk_crm_opp_company_code"),
        CheckConstraint(
            "current_stage IN ('qualification','discovery','proposal','negotiation','won','lost')",
            name="ck_crm_opp_stage",
        ),
        CheckConstraint(
            "status IN ('open','won','lost','cancelled')",
            name="ck_crm_opp_status",
        ),
        CheckConstraint(
            "probability_percent >= 0 AND probability_percent <= 100",
            name="ck_crm_opp_prob",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    opportunity_code: Mapped[str] = mapped_column(String(50), nullable=False)
    opportunity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False)
    lead_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_lead.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    pipeline_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_pipeline.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    current_stage: Mapped[str] = mapped_column(String(30), nullable=False, default="qualification")
    expected_revenue: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    probability_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    forecast_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
    sales_quotation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    sales_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    source_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Sales-process (Zoho-replacement) extensions. Nullable / defaulted so
    # legacy opportunities created via the old CRM POST /opportunities flow
    # are unaffected. Only opportunities created via lead-convert receive a
    # non-null blueprint_state and therefore support blueprint actions. ---
    company_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_company.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    blueprint_state: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    boq_attached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    boq_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sow_attached: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sow_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sow_skipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    deal_reg_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    oem_quotation_received: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    oem_quote_attached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    customer_po_attached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    customer_po_approved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    deal_won_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    project_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    has_hardware: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    has_software: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    has_services: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
