"""CRM OVF (Order Value Form) and OVF Line ORM models.

OVF is created only after the customer PO is approved on the opportunity, and
carries vendor/customer payment terms used to compute the finance cost.
"""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmOvf(Base, *CrmTransactionMixin):
    __tablename__ = "crm_ovf"
    __table_args__ = (
        CheckConstraint(
            "approval_status IN ('not_required','pending','approved','rejected')",
            name="ck_crm_ovf_approval_status",
        ),
        CheckConstraint(
            "blueprint_state IN ('draft','approval','approved','shared_scm','deal_won')",
            name="ck_crm_ovf_blueprint_state",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ovf_no: Mapped[str] = mapped_column(String(50), nullable=False)
    quote_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_quote.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
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
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quote_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    billing_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    billing_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipping_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    technology_segment: Mapped[str | None] = mapped_column(Text, nullable=True)
    sub_technology_segment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    installation_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    approval_status: Mapped[str] = mapped_column(String(30), nullable=False, default="not_required")
    shared_to_scm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    deal_won: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    deal_won_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    vendor_payment_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    customer_payment_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    finance_cost_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=0)

    additional_charges: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    freight: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_margin_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=0)
    total_margin_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    blueprint_state: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")


class CrmOvfLine(Base, *CrmTransactionMixin):
    __tablename__ = "crm_ovf_line"
    __table_args__ = (
        CheckConstraint(
            "side IN ('customer_po','vendor')",
            name="ck_crm_ovf_line_side",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ovf_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_ovf.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    side: Mapped[str] = mapped_column(String(20), nullable=False, default="customer_po")
    line_no: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
