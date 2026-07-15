"""Retention policy ORM per ERD_18 section 6.17."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocRetentionPolicy(Base, *DocMasterMixin):
    __tablename__ = "doc_retention_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_code", name="uk_doc_retention_policy_code"),
        CheckConstraint("retention_days > 0", name="ck_doc_retention_policy_days"),
        CheckConstraint(
            "action_on_expiry IN ('archive','dispose','review')",
            name="ck_doc_retention_policy_action",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive')",
            name="ck_doc_retention_policy_status",
        ),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    action_on_expiry: Mapped[str] = mapped_column(String(30), nullable=False, default="archive")
    applies_to_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    applies_to_classification: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

