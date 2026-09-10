"""Create QmScar table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.scar import QmScar  # noqa: F401

revision: str = "0502_qm_scar"
down_revision: str | None = "0501_seed_qm_spc_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmScar.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmScar.__table__.drop(bind=op.get_bind(), checkfirst=True)
