"""Create QmInspectionPlan table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.inspection_plan import QmInspectionPlan  # noqa: F401

revision: str = "0118_qm_inspection_plan"
down_revision: str | None = "0117_qm_defect_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmInspectionPlan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmInspectionPlan.__table__.drop(bind=op.get_bind(), checkfirst=True)
