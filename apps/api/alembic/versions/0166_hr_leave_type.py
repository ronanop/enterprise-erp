"""Create HrLeaveType table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0166_hr_leave_type"
down_revision: str | None = "0165_hr_holiday_calendar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.leave_type import HrLeaveType  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveType.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.leave_type import HrLeaveType  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveType.__table__.drop(bind=op.get_bind(), checkfirst=True)
