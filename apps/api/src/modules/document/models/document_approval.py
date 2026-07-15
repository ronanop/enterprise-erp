"""Document approval ORM per ERD_18 section 6.10."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocTransactionMixin


class DocDocumentApproval(Base, *DocTransactionMixin):
    __tablename__ = "doc_document_approval"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_approval_number"),
        CheckConstraint(
            "approval_type IN ('content_approval','publish','archive')",
            name="ck_doc_document_approval_type",
        ),
        CheckConstraint(
            "decision IN ('pending','approved','rejected')",
            name="ck_doc_document_approval_decision",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','completed','cancelled')",
            name="ck_doc_document_approval_status",
        ),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)

    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    approval_type: Mapped[str] = mapped_column(String(40), nullable=False, default="content_approval")

    requested_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    approver_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    decision: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

