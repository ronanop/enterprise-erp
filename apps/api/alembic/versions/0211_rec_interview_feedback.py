"""Create RecInterviewFeedback table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0211_rec_interview_feedback"
down_revision: str | None = "0210_rec_interview"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.interview_feedback import RecInterviewFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    RecInterviewFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.interview_feedback import RecInterviewFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    RecInterviewFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
