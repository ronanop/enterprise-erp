"""Document metadata ORM per ERD_18 section 6.4."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentMetadata(Base, *DocDetailMixin):
    __tablename__ = "doc_document_metadata"
    __table_args__ = (
        UniqueConstraint("document_id", "meta_key", name="uk_doc_document_metadata_key"),
        CheckConstraint(
            "value_type IN ('string','number','date','boolean','json')",
            name="ck_doc_document_metadata_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_metadata_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    meta_key: Mapped[str] = mapped_column(String(100), nullable=False)
    meta_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
