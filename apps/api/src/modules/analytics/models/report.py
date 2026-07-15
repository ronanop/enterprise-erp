"""Report ORM per ERD_20 section 6.3."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiReport(Base, *BiRowMixin):
    __tablename__ = "bi_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_number", name="uk_bi_report_number"),
        UniqueConstraint("company_id", "report_code", name="uk_bi_report_code"),
        CheckConstraint(
            "report_type IN ('operational','financial','cross_module','ad_hoc','scheduled')",
            name="ck_bi_report_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_bi_report_status",
        ),
        Index("ix_bi_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    report_number: Mapped[str] = mapped_column(String(50), nullable=False)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)

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

    dataset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_dataset.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_report_dataset",
        ),
        nullable=True,
        index=True,
    )
    definition_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

