"""Resolution ORM per ERD_17 section 6.13."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdResolution(Base, *HdTransactionMixin):
    __tablename__ = "hd_resolution"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_resolution_doc"),
        CheckConstraint(
            "resolution_code IN ('fixed','workaround','duplicate','cannot_reproduce',"
            "'known_error','other')",
            name="ck_hd_resolution_code",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','completed','cancelled')",
            name="ck_hd_resolution_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resolution_code: Mapped[str] = mapped_column(String(40), nullable=False)
    resolution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_article_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_knowledge_article.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_time_fix: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
