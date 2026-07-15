"""KPI ORM per ERD_20 section 6.9."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiKpi(Base, *BiRowMixin):
    __tablename__ = "bi_kpi"
    __table_args__ = (
        UniqueConstraint("company_id", "kpi_number", name="uk_bi_kpi_number"),
        UniqueConstraint("company_id", "kpi_code", name="uk_bi_kpi_code"),
        CheckConstraint(
            "direction IS NULL OR direction IN ('higher_better','lower_better')",
            name="ck_bi_kpi_direction",
        ),
        CheckConstraint(
            "period_grain IS NULL OR period_grain IN ('day','week','month','quarter','year')",
            name="ck_bi_kpi_period_grain",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive','cancelled')",
            name="ck_bi_kpi_status",
        ),
        Index("ix_bi_kpi_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    kpi_number: Mapped[str] = mapped_column(String(50), nullable=False)
    kpi_code: Mapped[str] = mapped_column(String(50), nullable=False)
    kpi_name: Mapped[str] = mapped_column(String(255), nullable=False)

    metric_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_metric.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

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
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    warning_threshold: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    critical_threshold: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(20), nullable=True)
    period_grain: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

