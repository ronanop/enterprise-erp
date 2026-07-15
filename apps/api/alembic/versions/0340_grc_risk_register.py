"""Create GrcRiskRegister table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.risk_register import GrcRiskRegister  # noqa: F401

revision: str = "0340_grc_risk_register"
down_revision: str | None = "0339_grc_risk_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcRiskRegister.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcRiskRegister.__table__.drop(bind=op.get_bind(), checkfirst=True)
