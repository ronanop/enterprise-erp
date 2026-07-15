"""Create GrcCorrectiveAction table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.corrective_action import GrcCorrectiveAction  # noqa: F401

revision: str = "0348_grc_corrective_action"
down_revision: str | None = "0347_grc_audit_finding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcCorrectiveAction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcCorrectiveAction.__table__.drop(bind=op.get_bind(), checkfirst=True)
