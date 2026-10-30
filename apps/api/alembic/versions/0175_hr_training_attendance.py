"""Create HrTrainingAttendance table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0175_hr_training_attendance"
down_revision: str | None = "0174_hr_training"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.training_attendance import HrTrainingAttendance  # noqa: F401
    except ModuleNotFoundError:
        return
    HrTrainingAttendance.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.training_attendance import HrTrainingAttendance  # noqa: F401
    except ModuleNotFoundError:
        return
    HrTrainingAttendance.__table__.drop(bind=op.get_bind(), checkfirst=True)
