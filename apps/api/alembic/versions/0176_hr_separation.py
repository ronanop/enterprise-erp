"""Create HrSeparation table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import create_orm_table_defer_columns  # noqa: E402
from modules.hr.models.separation import HrSeparation  # noqa: F401

revision: str = "0176_hr_separation"
down_revision: str | None = "0175_hr_training_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# FNF link added in 0477 (after pay_payroll_run exists).
_DEFER = {"fnf_status", "fnf_payroll_run_id"}


def upgrade() -> None:
    create_orm_table_defer_columns(
        HrSeparation.__table__,
        op.get_bind(),
        _DEFER,
    )


def downgrade() -> None:
    HrSeparation.__table__.drop(bind=op.get_bind(), checkfirst=True)
