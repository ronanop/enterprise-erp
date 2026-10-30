"""Create HrShiftAssignment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0164_hr_shift_assignment"
down_revision: str | None = "0163_hr_shift"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.shift_assignment import HrShiftAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrShiftAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.shift_assignment import HrShiftAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    HrShiftAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
