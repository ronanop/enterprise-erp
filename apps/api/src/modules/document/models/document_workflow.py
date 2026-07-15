"""Document workflow config ORM per ERD_18 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocDocumentWorkflow(Base, *DocMasterMixin):
    __tablename__ = "doc_document_workflow"
    __table_args__ = (
        UniqueConstraint("company_id", "workflow_code", name="uk_doc_document_workflow_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_workflow_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_code: Mapped[str] = mapped_column(String(80), nullable=False)
    workflow_name: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    foundation_workflow_code: Mapped[str] = mapped_column(String(80), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
