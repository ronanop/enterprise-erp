"""Create BiAlertNotification table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.alert_notification import BiAlertNotification  # noqa: F401

revision: str = "0369_bi_alert_notification"
down_revision: str | None = "0368_bi_alert_rule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiAlertNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiAlertNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
