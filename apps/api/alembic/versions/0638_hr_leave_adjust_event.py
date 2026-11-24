"""Create hr.hr_leave_adjust_event for per-day leave adjust history."""

from collections.abc import Sequence

from alembic import op

revision: str = "0638_hr_leave_adjust_event"
down_revision: str | None = "0637_pay_policy_fixed_30_sandwich_pf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.leave_adjust_event import HrLeaveAdjustEvent  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveAdjustEvent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.leave_adjust_event import HrLeaveAdjustEvent  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveAdjustEvent.__table__.drop(bind=op.get_bind(), checkfirst=True)
