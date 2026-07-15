"""Knowledge article ORM per ERD_17 section 6.12."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdKnowledgeArticle(Base, *HdDetailMixin):
    __tablename__ = "hd_knowledge_article"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_knowledge_article_doc"),
        UniqueConstraint("knowledge_base_id", "article_code", name="uk_hd_knowledge_article_code"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_hd_knowledge_article_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    knowledge_base_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_knowledge_base.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
