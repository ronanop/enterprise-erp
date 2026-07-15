"""Alert rule ORM per ERD_20 section 6.14."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiAlertRule(Base, *BiRowMixin):
    __tablename__ = "bi_alert_rule"
    __table_args__ = (
        UniqueConstraint("company_id", "alert_number", name="uk_bi_alert_rule_number"),
        UniqueConstraint("company_id", "alert_code", name="uk_bi_alert_rule_code"),
        CheckConstraint(
            "condition_operator IN ('gt','gte','lt','lte','eq','neq','between')",
            name="ck_bi_alert_condition_op",
        ),
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_bi_alert_severity",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','paused','retired')",
            name="ck_bi_alert_rule_status",
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

    alert_number: Mapped[str] = mapped_column(String(50), nullable=False)
    alert_code: Mapped[str] = mapped_column(String(50), nullable=False)
    alert_name: Mapped[str] = mapped_column(String(255), nullable=False)

    kpi_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_kpi.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    metric_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_metric.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    condition_operator: Mapped[str] = mapped_column(String(20), nullable=False)
    threshold_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    threshold_upper: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

