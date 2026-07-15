"""Create GrcComplianceAssessment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.compliance_assessment import GrcComplianceAssessment  # noqa: F401

revision: str = "0344_grc_compliance_assessment"
down_revision: str | None = "0343_grc_compliance_fw_req"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcComplianceAssessment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcComplianceAssessment.__table__.drop(bind=op.get_bind(), checkfirst=True)
