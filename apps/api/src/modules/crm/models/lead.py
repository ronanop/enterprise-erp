"""CRM lead ORM."""

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
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmLead(Base, *CrmTransactionMixin):
    __tablename__ = "crm_lead"
    __table_args__ = (
        UniqueConstraint("company_id", "lead_code", name="uk_crm_lead_company_code"),
        CheckConstraint(
            "status IN ('new','assigned','contacted','qualified','unqualified','converted','lost')",
            name="ck_crm_lead_status",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    lead_code: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str] = mapped_column(String(30), nullable=False)
    lead_source_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_lead_source.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    territory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    has_authority: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    need_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    timeline_text: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qualification_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_campaign.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="new", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
    converted_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Sales-process (Zoho-replacement) extensions. Nullable so legacy
    # leads created via the old CRM flow remain untouched. ---
    company_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_company.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    expected_closure_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    salutation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    product_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sub_product_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sub_product: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sub_product_other: Mapped[str | None] = mapped_column(String(100), nullable=True)
    engagement_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    portal_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    assign_to_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requirement_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dr_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_dr_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deal_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zip: Mapped[str | None] = mapped_column(String(30), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    oem_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    oem_contact_person: Mapped[str | None] = mapped_column(String(150), nullable=True)
    oem_contact_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    oem_contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distributor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    distributor_contact: Mapped[str | None] = mapped_column(String(150), nullable=True)
    distributor_contact_person: Mapped[str | None] = mapped_column(String(150), nullable=True)
    distributor_contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distributor_department: Mapped[str | None] = mapped_column(String(150), nullable=True)
    end_customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    end_customer_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_gst: Mapped[str | None] = mapped_column(String(30), nullable=True)
    entity_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blueprint_state: Mapped[str] = mapped_column(String(30), nullable=False, default="open", server_default="open")
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    convert_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
