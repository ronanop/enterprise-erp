"""Create GrcReport table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.report import GrcReport  # noqa: F401

revision: str = "0352_grc_report"
down_revision: str | None = "0351_grc_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
