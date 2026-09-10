"""Create QmPfmeaLine table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.pfmea import QmPfmeaLine  # noqa: F401

revision: str = "0496_qm_pfmea_line"
down_revision: str | None = "0495_qm_pfmea"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmPfmeaLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmPfmeaLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
