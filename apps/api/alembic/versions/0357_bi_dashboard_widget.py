"""Create BiDashboardWidget table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.dashboard_widget import BiDashboardWidget  # noqa: F401

revision: str = "0357_bi_dashboard_widget"
down_revision: str | None = "0356_bi_dashboard"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiDashboardWidget.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiDashboardWidget.__table__.drop(bind=op.get_bind(), checkfirst=True)
