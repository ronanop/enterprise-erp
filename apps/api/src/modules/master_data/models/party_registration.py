"""Party (customer/vendor) registration form ORM model."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.master_data.models.mixins import MasterBranchRecordMixin


class MasterPartyRegistration(Base, *MasterBranchRecordMixin):
    """Customer Registration Form (CRF) and Vendor Registration Form (VRF).

    A registration is the onboarding record: identity, KYC documents, and the
    credit terms the party is asking for. Approving it is what creates the
    ``master_customer`` / ``master_vendor`` row, so no party enters the masters
    without KYC and a credit decision behind it.
    """

    __tablename__ = "master_party_registration"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "registration_code", name="uk_master_party_reg_company_code"
        ),
        CheckConstraint(
            "party_type IN ('customer','vendor')",
            name="ck_master_party_reg_party_type",
        ),
        CheckConstraint(
            "kyc_status IN ('pending','verified','rejected')",
            name="ck_master_party_reg_kyc_status",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','under_review','approved','rejected','converted')",
            name="ck_master_party_reg_status",
        ),
        {"schema": "master"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    registration_code: Mapped[str] = mapped_column(String(50), nullable=False)
    party_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    legal_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    trade_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    party_subtype: Mapped[str | None] = mapped_column(String(30), nullable=True)

    tax_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cin_number: Mapped[str | None] = mapped_column(String(30), nullable=True)

    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    bank_details_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    kyc_documents_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    kyc_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    kyc_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    kyc_verified_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    declared_annual_turnover: Mapped[float | None] = mapped_column(
        Numeric(18, 2), nullable=True
    )
    requested_credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    requested_credit_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    expected_monthly_spend: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    early_payment_discount_pct: Mapped[float | None] = mapped_column(
        Numeric(6, 3), nullable=True
    )
    currency_code: Mapped[str | None] = mapped_column(String(3), nullable=True)

    evaluation_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    assessed_credit_limit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    assessed_credit_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    risk_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evaluated_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    # Where the registration came from. Plain UUIDs - CRM owns those tables and
    # master data must not depend on another module's schema.
    source_crm_company_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    source_kyc_record_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
    )
    vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="SET NULL"),
        nullable=True,
    )
