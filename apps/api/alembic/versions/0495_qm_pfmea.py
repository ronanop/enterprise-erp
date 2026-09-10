"""Create QmPfmea table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.pfmea import QmPfmea  # noqa: F401

revision: str = "0495_qm_pfmea"
down_revision: str | None = "0494_qm_char_reaction_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmPfmea.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmPfmea.__table__.drop(bind=op.get_bind(), checkfirst=True)
