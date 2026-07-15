"""Document version ORM per ERD_18 section 6.3."""

from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentVersion(Base, *DocDetailMixin):
    __tablename__ = "doc_document_version"
    __table_args__ = (
        UniqueConstraint("document_id", "version_no", name="uk_doc_document_version_no"),
        CheckConstraint(
            "status IN ('active','superseded','deleted_soft')",
            name="ck_doc_document_version_status",
        ),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
