"""Create QmCapa table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.capa import QmCapa  # noqa: F401

revision: str = "0126_qm_capa"
down_revision: str | None = "0125_qm_ncr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmCapa.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmCapa.__table__.drop(bind=op.get_bind(), checkfirst=True)
