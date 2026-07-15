"""Create BiSubscription table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.subscription import BiSubscription  # noqa: F401

revision: str = "0370_bi_subscription"
down_revision: str | None = "0369_bi_alert_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiSubscription.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiSubscription.__table__.drop(bind=op.get_bind(), checkfirst=True)
