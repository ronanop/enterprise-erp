"""Create hr.hr_leave_adjust_event for per-day leave adjust history."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.hr.models.leave_adjust_event import HrLeaveAdjustEvent  # noqa: F401

revision: str = "0590_hr_leave_adjust_event"
down_revision: str | None = "0589_pay_policy_fixed_30_sandwich_pf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HrLeaveAdjustEvent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HrLeaveAdjustEvent.__table__.drop(bind=op.get_bind(), checkfirst=True)
