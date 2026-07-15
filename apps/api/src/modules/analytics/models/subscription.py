"""Subscription ORM per ERD_20 section 6.16."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiSubscription(Base, *BiRowMixin):
    __tablename__ = "bi_subscription"
    __table_args__ = (
        UniqueConstraint("company_id", "subscription_number", name="uk_bi_subscription_number"),
        CheckConstraint(
            "target_type IN ('dashboard','report','kpi','alert')",
            name="ck_bi_subscription_target_type",
        ),
        CheckConstraint(
            "channel IN ('in_app','email','webhook')",
            name="ck_bi_subscription_channel",
        ),
        CheckConstraint(
            "frequency IN ('realtime','daily','weekly','monthly')",
            name="ck_bi_subscription_frequency",
        ),
        CheckConstraint(
            "status IN ('active','paused','cancelled')",
            name="ck_bi_subscription_status",
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

    subscription_number: Mapped[str] = mapped_column(String(50), nullable=False)

    subscriber_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)

    dashboard_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_dashboard.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    report_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_report.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    kpi_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_kpi.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    alert_rule_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_alert_rule.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    frequency: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
