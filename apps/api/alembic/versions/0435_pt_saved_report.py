"""Create PtSavedReport table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.saved_report import PtSavedReport  # noqa: F401

revision: str = "0435_pt_saved_report"
down_revision: str | None = "0434_pt_download_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtSavedReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtSavedReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
