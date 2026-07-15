"""Metric ORM per ERD_20 section 6.8."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiMetric(Base, *BiRowMixin):
    __tablename__ = "bi_metric"
    __table_args__ = (
        UniqueConstraint("company_id", "metric_code", name="uk_bi_metric_code"),
        CheckConstraint(
            "metric_category IN ('financial','sales','operations','hr','quality','project','custom')",
            name="ck_bi_metric_category",
        ),
        CheckConstraint(
            "aggregation IN ('sum','avg','count','min','max','distinct_count','ratio')",
            name="ck_bi_metric_aggregation",
        ),
        CheckConstraint(
            "status IN ('draft','active','deprecated')",
            name="ck_bi_metric_status",
        ),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    metric_code: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False)

    dataset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_dataset.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    metric_category: Mapped[str] = mapped_column(String(40), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(30), nullable=False)
    expression_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
