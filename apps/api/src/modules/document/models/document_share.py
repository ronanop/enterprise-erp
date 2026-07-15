"""Document share ORM per ERD_18 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentShare(Base, *DocDetailMixin):
    __tablename__ = "doc_document_share"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_share_number"),
        CheckConstraint("permission_level IN ('view','comment')", name="ck_doc_document_share_level"),
        CheckConstraint(
            "status IN ('active','expired','revoked')",
            name="ck_doc_document_share_status",
        ),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    shared_with_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    shared_with_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    share_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permission_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
