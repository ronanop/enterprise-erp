"""Create RecRecruitmentReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0220_rec_recruitment_report"
down_revision: str | None = "0219_rec_onboarding_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.recruitment_report import RecRecruitmentReport  # noqa: F401
    except ModuleNotFoundError:
        return
    RecRecruitmentReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.recruitment_report import RecRecruitmentReport  # noqa: F401
    except ModuleNotFoundError:
        return
    RecRecruitmentReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
