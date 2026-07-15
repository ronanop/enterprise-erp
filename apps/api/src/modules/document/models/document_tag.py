"""Document tag ORM per ERD_18 section 6.5."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocDocumentTag(Base, *DocMasterMixin):
    __tablename__ = "doc_document_tag"
    __table_args__ = (
        UniqueConstraint("company_id", "tag_code", name="uk_doc_document_tag_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_tag_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tag_code: Mapped[str] = mapped_column(String(50), nullable=False)
    tag_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag_group: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
