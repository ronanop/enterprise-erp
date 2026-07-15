"""Knowledge base ORM per ERD_17 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdKnowledgeBase(Base, *HdMasterMixin):
    __tablename__ = "hd_knowledge_base"
    __table_args__ = (
        UniqueConstraint("company_id", "kb_code", name="uk_hd_knowledge_base_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_knowledge_base_status",
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

    kb_code: Mapped[str] = mapped_column(String(50), nullable=False)
    kb_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
