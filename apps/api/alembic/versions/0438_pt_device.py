"""Create PtDevice table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.device import PtDevice  # noqa: F401

revision: str = "0438_pt_device"
down_revision: str | None = "0437_pt_preference"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtDevice.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtDevice.__table__.drop(bind=op.get_bind(), checkfirst=True)
