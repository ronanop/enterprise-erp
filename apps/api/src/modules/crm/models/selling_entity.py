"""CRM selling / billing entity master (used on leads)."""

from uuid import UUID, uuid4

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmSellingEntity(Base, *CrmMasterMixin):
    __tablename__ = "crm_selling_entity"
    __table_args__ = (
        UniqueConstraint("company_id", "entity_code", name="uk_crm_selling_entity_company_code"),
        UniqueConstraint("company_id", "entity_name", name="uk_crm_selling_entity_company_name"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_code: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_gst: Mapped[str | None] = mapped_column(String(30), nullable=True)
    entity_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
