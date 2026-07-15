"""Create GrcRiskAssessment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.risk_assessment import GrcRiskAssessment  # noqa: F401

revision: str = "0341_grc_risk_assessment"
down_revision: str | None = "0340_grc_risk_register"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcRiskAssessment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcRiskAssessment.__table__.drop(bind=op.get_bind(), checkfirst=True)
