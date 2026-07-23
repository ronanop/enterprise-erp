"""Generic CRM attachment metadata (BOQ / SOW / OEM quote / customer PO / vendor quote / other)."""

from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmDetailMixin


class CrmAttachment(Base, *CrmDetailMixin):
    __tablename__ = "crm_attachment"
    __table_args__ = (
        CheckConstraint(
            "category IN ('boq','sow','oem_quote','customer_po','vendor_quote','other')",
            name="ck_crm_attachment_category",
        ),
        CheckConstraint(
            "source IN ('upload','link','google_drive','onedrive','dropbox','box')",
            name="ck_crm_attachment_source",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uploaded_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="upload")
