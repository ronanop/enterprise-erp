"""Create QmDefect table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.defect import QmDefect  # noqa: F401

revision: str = "0124_qm_defect"
down_revision: str | None = "0123_qm_final_inspection"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmDefect.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmDefect.__table__.drop(bind=op.get_bind(), checkfirst=True)
