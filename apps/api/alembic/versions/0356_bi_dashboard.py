"""Create BiDashboard table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.dashboard import BiDashboard  # noqa: F401

revision: str = "0356_bi_dashboard"
down_revision: str | None = "0355_create_analytics_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiDashboard.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiDashboard.__table__.drop(bind=op.get_bind(), checkfirst=True)
