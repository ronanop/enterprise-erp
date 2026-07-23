"""CRM sales Quote and Quote Line ORM models."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
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


class CrmQuote(Base, *CrmTransactionMixin):
    __tablename__ = "crm_quote"
    __table_args__ = (
        UniqueConstraint("company_id", "quote_no", name="uk_crm_quote_company_no"),
        CheckConstraint(
            "quote_stage IN ('draft','internal_approval','approved_internal',"
            "'sent_to_customer','negotiation','follow_up','accepted','lost')",
            name="ck_crm_quote_stage",
        ),
        CheckConstraint(
            "approval_status IN ('not_required','pending','approved','rejected')",
            name="ck_crm_quote_approval_status",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    opportunity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_opportunity.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    company_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_company.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_contact.id", ondelete="SET NULL"),
        nullable=True,
    )
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    quote_no: Mapped[str] = mapped_column(String(50), nullable=False)
    quote_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    quote_stage: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    approval_status: Mapped[str] = mapped_column(String(30), nullable=False, default="not_required")
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_gst: Mapped[str | None] = mapped_column(String(30), nullable=True)
    entity_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)

    billing_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    freight: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    avg_margin_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=0)
    total_margin_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    vendor_quote_attached: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason_for_discount: Mapped[str | None] = mapped_column(Text, nullable=True)
    sales_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)


class CrmQuoteLine(Base, *CrmTransactionMixin):
    __tablename__ = "crm_quote_line"
    __table_args__ = (
        CheckConstraint(
            "line_type IN ('hardware','software','services')",
            name="ck_crm_quote_line_type",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    quote_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_quote.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_no: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_product.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hsn_sac: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    line_type: Mapped[str] = mapped_column(String(20), nullable=False, default="hardware")
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    unit_sell: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    margin_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=0)
    margin_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    gst_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
