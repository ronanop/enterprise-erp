"""Lightweight CRM product catalog used for quote / OVF line lookups."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmProduct(Base, *CrmMasterMixin):
    __tablename__ = "crm_product"
    __table_args__ = (
        UniqueConstraint("company_id", "product_code", name="uk_crm_product_company_code"),
        CheckConstraint(
            "product_type IN ('hardware','software','services')",
            name="ck_crm_product_type",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_code: Mapped[str] = mapped_column(String(50), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_type: Mapped[str] = mapped_column(String(20), nullable=False)
    hsn_sac: Mapped[str | None] = mapped_column(String(20), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
