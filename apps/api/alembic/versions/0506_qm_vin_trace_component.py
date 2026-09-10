"""Create QmVinTraceComponent table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.vin_trace import QmVinTraceComponent  # noqa: F401

revision: str = "0506_qm_vin_trace_component"
down_revision: str | None = "0505_qm_vin_trace"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmVinTraceComponent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmVinTraceComponent.__table__.drop(bind=op.get_bind(), checkfirst=True)
