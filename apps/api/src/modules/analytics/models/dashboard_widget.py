"""Dashboard widget ORM per ERD_20 section 6.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDashboardWidget(Base, *BiRowMixin):
    __tablename__ = "bi_dashboard_widget"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "widget_code", name="uk_bi_dashboard_widget_code"),
        CheckConstraint(
            "widget_type IN ('kpi_tile','chart','table','gauge','map','text','iframe')",
            name="ck_bi_widget_type",
        ),
        CheckConstraint(
            "status IN ('active','hidden','archived')",
            name="ck_bi_widget_status",
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

    dashboard_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dashboard.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    widget_code: Mapped[str] = mapped_column(String(50), nullable=False)
    widget_title: Mapped[str] = mapped_column(String(255), nullable=False)
    widget_type: Mapped[str] = mapped_column(String(40), nullable=False)

    metric_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_metric.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_widget_metric",
        ),
        nullable=True,
        index=True,
    )

    kpi_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_kpi.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_widget_kpi",
        ),
        nullable=True,
        index=True,
    )

    report_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_report.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_widget_report",
        ),
        nullable=True,
        index=True,
    )

    dataset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_dataset.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_bi_widget_dataset",
        ),
        nullable=True,
        index=True,
    )
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
