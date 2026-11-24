"""Create PrjTimesheetEntry table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0230_prj_timesheet_entry"
down_revision: str | None = "0229_prj_timesheet"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.timesheet_entry import PrjTimesheetEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjTimesheetEntry.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.timesheet_entry import PrjTimesheetEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjTimesheetEntry.__table__.drop(bind=op.get_bind(), checkfirst=True)
