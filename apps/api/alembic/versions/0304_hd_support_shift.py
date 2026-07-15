"""Create HdSupportShift table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.support_shift import HdSupportShift  # noqa: F401

revision: str = "0304_hd_support_shift"
down_revision: str | None = "0303_hd_support_team"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdSupportShift.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdSupportShift.__table__.drop(bind=op.get_bind(), checkfirst=True)
