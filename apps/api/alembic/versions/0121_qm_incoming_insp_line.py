"""Create QmIncomingInspectionLine table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.incoming_inspection import QmIncomingInspectionLine  # noqa: F401

revision: str = "0121_qm_incoming_insp_line"
down_revision: str | None = "0120_qm_incoming_insp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmIncomingInspectionLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmIncomingInspectionLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
