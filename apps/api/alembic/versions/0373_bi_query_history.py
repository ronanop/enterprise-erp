"""Create BiQueryHistory table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.query_history import BiQueryHistory  # noqa: F401

revision: str = "0373_bi_query_history"
down_revision: str | None = "0372_bi_data_import"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiQueryHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiQueryHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
