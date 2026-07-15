"""Create BiReportSchedule table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.report_schedule import BiReportSchedule  # noqa: F401

revision: str = "0359_bi_report_schedule"
down_revision: str | None = "0358_bi_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiReportSchedule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiReportSchedule.__table__.drop(bind=op.get_bind(), checkfirst=True)
