"""CRM saved custom report ORM."""

from uuid import UUID, uuid4

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmSavedReport(Base, *CrmMasterMixin):
    __tablename__ = "crm_saved_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_crm_saved_report_company_code"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    folder_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # {"columns": ["field_key", ...], "column_labels": {"field_key": "Label"}}
    definition_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    owner_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
