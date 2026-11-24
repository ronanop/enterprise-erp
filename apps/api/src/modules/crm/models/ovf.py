"""CRM OVF (Order Value Form) and OVF Line ORM models.

OVF is created only after the customer PO is approved on the opportunity, and
carries vendor/customer payment terms used to compute the finance cost.
"""

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
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
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
        CheckConstraint(
            "invoice_channel IS NULL OR invoice_channel IN ('portal','physical','mixed')",
            name="ck_crm_ovf_invoice_channel",
        ),
        CheckConstraint(
            "freight_medium IS NULL OR freight_medium IN ('air','road','sea','courier')",
            name="ck_crm_ovf_freight_medium",
        ),
        CheckConstraint(
            "scm_hold_request_status IS NULL OR scm_hold_request_status IN "
            "('pending','accepted','rejected')",
            name="ck_crm_ovf_hold_request_status",
        ),
        CheckConstraint(
            "scm_charge_request_status IS NULL OR scm_charge_request_status IN "
            "('pending','accepted','rejected')",
            name="ck_crm_ovf_charge_request_status",
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
    po_date: Mapped[date | None] = mapped_column(Date, nullable=True)
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
    custom_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    shared_to_scm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    shared_to_scm_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scm_on_hold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    scm_on_hold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scm_hold_blocked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    scm_last_hold_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scm_last_hold_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scm_hold_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    scm_on_hold_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Hold is applied only after a Hold approve / reject owner accepts this request.
    scm_hold_request_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scm_hold_request_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    scm_hold_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scm_hold_requested_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    # Freight / finance edits wait here until a Freight & finance approver accepts them.
    scm_charge_request_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scm_charge_request_freight: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    scm_charge_request_finance_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 3), nullable=True
    )
    scm_charge_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scm_charge_requested_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    deal_won: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    deal_won_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    vendor_payment_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    customer_payment_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    finance_cost_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=0)

    additional_charges: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    freight: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_margin_pct: Mapped[Decimal] = mapped_column(Numeric(22, 10), nullable=False, default=0)
    total_margin_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)

    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    blueprint_state: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")

    # Savings supply chain negotiated off the OVF vendor price after handoff.
    # Credited to SCM, never to the sales incentive, and never exposed to Sales.
    scm_savings_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=0, server_default="0"
    )
    scm_negotiated_vendor_total: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    # Customer invoicing + AR. HSN lines ship physically with the material;
    # SAC lines are submitted on the customer portal.
    invoice_channel: Mapped[str | None] = mapped_column(String(20), nullable=True)
    invoice_submitted_portal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    invoice_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invoice_submitted_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    invoice_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_delay_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Live margin: frozen at approval, then re-priced nightly for overdue
    # receivables, stock held against the deal, and approved execution
    # expenses until Finance marks the full payment received.
    margin_at_approval_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    margin_at_approval_pct: Mapped[Decimal | None] = mapped_column(Numeric(22, 10), nullable=True)
    execution_expense_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=0, server_default="0"
    )
    overdue_finance_cost: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=0, server_default="0"
    )
    holding_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0, server_default="0")
    early_payment_discount_pct: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=0, server_default="0"
    )
    live_margin_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    live_margin_pct: Mapped[Decimal | None] = mapped_column(Numeric(22, 10), nullable=True)
    live_margin_as_of: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    full_payment_received: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    full_payment_marked_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    delivery_weeks_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    delivery_weeks_max: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    negotiated_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    negotiation_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_vendor_total: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    freight_medium: Mapped[str | None] = mapped_column(String(20), nullable=True)
    freight_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    freight_insurance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class CrmOvfPayment(Base, *CrmTransactionMixin):
    """One customer receipt against an OVF (part payments allowed)."""

    __tablename__ = "crm_ovf_payment"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_crm_ovf_payment_amount"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ovf_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_ovf.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)


class CrmOvfExpense(Base, *CrmTransactionMixin):
    """Unplanned execution cost (cables, MATAD, visits...) raised until completion."""

    __tablename__ = "crm_ovf_expense"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_crm_ovf_expense_amount"),
        CheckConstraint(
            "expense_type IN ('operations','purchase','cables','matad','site_visit','foc','installation','other')",
            name="ck_crm_ovf_expense_type",
        ),
        CheckConstraint(
            "raised_by_team IN ('scm','operations','sales','presales','finance','other')",
            name="ck_crm_ovf_expense_team",
        ),
        CheckConstraint("status IN ('pending','approved','rejected')", name="ck_crm_ovf_expense_status"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ovf_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_ovf.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    expense_type: Mapped[str] = mapped_column(String(30), nullable=False)
    raised_by_team: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    incurred_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="pending")
    decided_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_remark: Mapped[str | None] = mapped_column(Text, nullable=True)


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
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    distributor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    gst_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=Decimal("18"))
    line_total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    # Vendor lines broken out of one customer PO line (multi-distributor split).
    source_line_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
