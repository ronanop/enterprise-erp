"""Create HrHolidayCalendar table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0165_hr_holiday_calendar"
down_revision: str | None = "0164_hr_shift_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: F401
    except ModuleNotFoundError:
        return
    HrHolidayCalendar.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: F401
    except ModuleNotFoundError:
        return
    HrHolidayCalendar.__table__.drop(bind=op.get_bind(), checkfirst=True)
