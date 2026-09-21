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
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
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
        CheckConstraint(
            "po_finance_status IN ('not_required','pending','approved','rejected')",
            name="ck_crm_opp_po_finance_status",
        ),
        CheckConstraint(
            "po_terms_status IN ('not_required','pending','approved','rejected')",
            name="ck_crm_opp_po_terms_status",
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

    # Customer PO is validated by Finance (tax/GST) and Legal (terms &
    # conditions) before Management gives the final go-ahead. Sales never
    # validates terms. ``po_approval_chain`` stores the approvers chosen for
    # each stage when the PO is first sent for approval.
    po_finance_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_required", server_default="not_required"
    )
    po_finance_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    po_finance_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    po_finance_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    po_terms_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_required", server_default="not_required"
    )
    po_terms_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    po_terms_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    po_terms_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    po_approval_chain: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    deal_won_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    project_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    has_hardware: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    has_software: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    has_services: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # Cloud-specific sales path (billing shift, migration, POC/assessment).
    cloud_blueprint_variant: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    product_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cloud_sub_product: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_mrr: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    customer_arr: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    customer_discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    distributor_discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    profitability_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    distributor_discount_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    assessment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    migration_credit_phase1: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    migration_credit_phase2: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    migration_credit_phase3: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    contract_attached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    onboarding_done: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    onboarding_date: Mapped[date | None] = mapped_column(Date, nullable=True)
