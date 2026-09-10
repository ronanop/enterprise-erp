"""Create QmSpcReading table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.spc_reading import QmSpcReading  # noqa: F401

revision: str = "0500_qm_spc_reading"
down_revision: str | None = "0499_seed_qm_ppap_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmSpcReading.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmSpcReading.__table__.drop(bind=op.get_bind(), checkfirst=True)
