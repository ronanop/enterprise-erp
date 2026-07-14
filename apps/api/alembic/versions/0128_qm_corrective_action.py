"""Create QmCorrectiveAction table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.capa import QmCorrectiveAction  # noqa: F401

revision: str = "0128_qm_corrective_action"
down_revision: str | None = "0127_qm_root_cause"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmCorrectiveAction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmCorrectiveAction.__table__.drop(bind=op.get_bind(), checkfirst=True)
