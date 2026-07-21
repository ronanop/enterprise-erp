"""CRM sales account (Company) ORM — distinct from master.master_customer."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmCompany(Base, *CrmTransactionMixin):
    """Sales Account. Optionally linked to master.master_customer, never a duplicate of it."""

    __tablename__ = "crm_company"
    __table_args__ = (
        UniqueConstraint("company_id", "account_number", name="uk_crm_company_account_number"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_number: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_owner_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    account_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    other_industries: Mapped[str | None] = mapped_column(String(255), nullable=True)
    portal_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    rating: Mapped[str | None] = mapped_column(String(30), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_ownership_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    customer_id_ext: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    billing_street: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_city: Mapped[str] = mapped_column(String(100), nullable=False)
    billing_state: Mapped[str] = mapped_column(String(100), nullable=False)
    billing_code: Mapped[str] = mapped_column(String(30), nullable=False)
    billing_country: Mapped[str] = mapped_column(String(100), nullable=False)

    shipping_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    master_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
