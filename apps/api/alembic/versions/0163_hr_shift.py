"""Create HrShift table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0163_hr_shift"
down_revision: str | None = "0162_hr_designation_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.shift import HrShift  # noqa: F401
    except ModuleNotFoundError:
        return
    HrShift.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.shift import HrShift  # noqa: F401
    except ModuleNotFoundError:
        return
    HrShift.__table__.drop(bind=op.get_bind(), checkfirst=True)
