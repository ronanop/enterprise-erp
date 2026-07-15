"""Create GrcRiskCategory table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.risk_category import GrcRiskCategory  # noqa: F401

revision: str = "0339_grc_risk_category"
down_revision: str | None = "0338_grc_control_test"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcRiskCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcRiskCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
