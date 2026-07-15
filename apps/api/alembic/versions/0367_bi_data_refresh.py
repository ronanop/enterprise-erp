"""Create BiDataRefresh table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.data_refresh import BiDataRefresh  # noqa: F401

revision: str = "0367_bi_data_refresh"
down_revision: str | None = "0366_bi_data_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiDataRefresh.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiDataRefresh.__table__.drop(bind=op.get_bind(), checkfirst=True)
