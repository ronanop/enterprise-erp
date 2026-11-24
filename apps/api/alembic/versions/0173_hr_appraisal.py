"""Create HrAppraisal table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0173_hr_appraisal"
down_revision: str | None = "0172_hr_goal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.appraisal import HrAppraisal  # noqa: F401
    except ModuleNotFoundError:
        return
    HrAppraisal.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.appraisal import HrAppraisal  # noqa: F401
    except ModuleNotFoundError:
        return
    HrAppraisal.__table__.drop(bind=op.get_bind(), checkfirst=True)
