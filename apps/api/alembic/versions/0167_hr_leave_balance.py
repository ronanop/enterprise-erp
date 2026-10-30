"""Create HrLeaveBalance table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0167_hr_leave_balance"
down_revision: str | None = "0166_hr_leave_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveBalance.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: F401
    except ModuleNotFoundError:
        return
    HrLeaveBalance.__table__.drop(bind=op.get_bind(), checkfirst=True)
