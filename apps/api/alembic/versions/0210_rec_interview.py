"""Create RecInterview table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0210_rec_interview"
down_revision: str | None = "0209_rec_application_stage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.interview import RecInterview  # noqa: F401
    except ModuleNotFoundError:
        return
    RecInterview.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.interview import RecInterview  # noqa: F401
    except ModuleNotFoundError:
        return
    RecInterview.__table__.drop(bind=op.get_bind(), checkfirst=True)
