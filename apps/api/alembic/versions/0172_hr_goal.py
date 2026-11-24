"""Create HrGoal table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0172_hr_goal"
down_revision: str | None = "0171_hr_performance_review"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.goal import HrGoal  # noqa: F401
    except ModuleNotFoundError:
        return
    HrGoal.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.goal import HrGoal  # noqa: F401
    except ModuleNotFoundError:
        return
    HrGoal.__table__.drop(bind=op.get_bind(), checkfirst=True)
