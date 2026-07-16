"""Create PtSavedSearch table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.saved_search import PtSavedSearch  # noqa: F401

revision: str = "0436_pt_saved_search"
down_revision: str | None = "0435_pt_saved_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtSavedSearch.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtSavedSearch.__table__.drop(bind=op.get_bind(), checkfirst=True)
