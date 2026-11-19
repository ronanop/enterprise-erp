"""CRM KYC record ORM."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmTransactionMixin


class CrmKycRecord(Base, *CrmTransactionMixin):
    __tablename__ = "crm_kyc_record"
    __table_args__ = (
        UniqueConstraint("company_id", "kyc_code", name="uk_crm_kyc_company_code"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    kyc_code: Mapped[str] = mapped_column(String(50), nullable=False)
    company_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_company.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quote_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_quote.id", ondelete="SET NULL"),
        nullable=True,
    )
    form_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
