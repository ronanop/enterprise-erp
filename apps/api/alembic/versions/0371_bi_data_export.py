"""Create BiDataExport table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.data_export import BiDataExport  # noqa: F401

revision: str = "0371_bi_data_export"
down_revision: str | None = "0370_bi_subscription"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiDataExport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiDataExport.__table__.drop(bind=op.get_bind(), checkfirst=True)
