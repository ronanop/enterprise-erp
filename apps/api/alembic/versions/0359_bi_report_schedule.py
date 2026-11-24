"""Create BiReportSchedule table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0359_bi_report_schedule"
down_revision: str | None = "0358_bi_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.report_schedule import BiReportSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReportSchedule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.report_schedule import BiReportSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReportSchedule.__table__.drop(bind=op.get_bind(), checkfirst=True)
