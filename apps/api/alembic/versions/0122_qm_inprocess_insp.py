"""Create QmInprocessInspection table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.inprocess_inspection import QmInprocessInspection  # noqa: F401

revision: str = "0122_qm_inprocess_insp"
down_revision: str | None = "0121_qm_incoming_insp_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmInprocessInspection.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmInprocessInspection.__table__.drop(bind=op.get_bind(), checkfirst=True)
