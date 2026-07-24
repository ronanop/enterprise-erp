"""CRM OEM partner master (reusable on leads)."""

from uuid import UUID, uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmOem(Base, *CrmMasterMixin):
    __tablename__ = "crm_oem"
    __table_args__ = (
        UniqueConstraint("company_id", "oem_code", name="uk_crm_oem_company_code"),
        UniqueConstraint("company_id", "oem_name", name="uk_crm_oem_company_name"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    oem_code: Mapped[str] = mapped_column(String(50), nullable=False)
    oem_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
