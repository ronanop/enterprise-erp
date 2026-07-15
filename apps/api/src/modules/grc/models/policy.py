"""Policy ORM per ERD_19 section 6.1."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcPolicy(Base, *GrcMasterMixin):
    __tablename__ = "grc_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_number", name="uk_grc_policy_number"),
        CheckConstraint(
            "policy_type IN ('hr','finance','it','security','procurement','compliance','other')",
            name="ck_grc_policy_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','superseded','retired','cancelled')",
            name="ck_grc_policy_status",
        ),
        Index("ix_grc_policy_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_policy_review_due", "review_due_at"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    policy_number: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_type: Mapped[str] = mapped_column(String(40), nullable=False)

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    current_version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    review_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

