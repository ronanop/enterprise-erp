"""Create BiReportExecution table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0360_bi_report_execution"
down_revision: str | None = "0359_bi_report_schedule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.report_execution import BiReportExecution  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReportExecution.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.report_execution import BiReportExecution  # noqa: F401
    except ModuleNotFoundError:
        return
    BiReportExecution.__table__.drop(bind=op.get_bind(), checkfirst=True)
