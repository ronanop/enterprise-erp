"""Create BiAlertRule table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.alert_rule import BiAlertRule  # noqa: F401

revision: str = "0368_bi_alert_rule"
down_revision: str | None = "0367_bi_data_refresh"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiAlertRule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiAlertRule.__table__.drop(bind=op.get_bind(), checkfirst=True)
