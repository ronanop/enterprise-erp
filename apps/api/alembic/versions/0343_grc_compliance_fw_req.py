"""Create grc compliance framework and requirement tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.compliance_framework import GrcComplianceFramework  # noqa: F401
from modules.grc.models.compliance_requirement import GrcComplianceRequirement  # noqa: F401

revision: str = "0343_grc_compliance_fw_req"
down_revision: str | None = "0342_grc_risk_treatment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcComplianceFramework.__table__.create(bind=op.get_bind(), checkfirst=True)
    GrcComplianceRequirement.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcComplianceRequirement.__table__.drop(bind=op.get_bind(), checkfirst=True)
    GrcComplianceFramework.__table__.drop(bind=op.get_bind(), checkfirst=True)
