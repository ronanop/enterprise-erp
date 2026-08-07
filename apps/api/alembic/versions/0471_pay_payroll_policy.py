"""Create PayPayrollPolicy table (Phase 0)."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.payroll.models.payroll_policy import PayPayrollPolicy  # noqa: F401

revision: str = "0471_pay_payroll_policy"
down_revision: str | None = "0470_ess_phase6_compliance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PayPayrollPolicy.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PayPayrollPolicy.__table__.drop(bind=op.get_bind(), checkfirst=True)
