"""Create RecApplicationStage table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0209_rec_application_stage"
down_revision: str | None = "0208_rec_application"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.application_stage import RecApplicationStage  # noqa: F401
    except ModuleNotFoundError:
        return
    RecApplicationStage.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.application_stage import RecApplicationStage  # noqa: F401
    except ModuleNotFoundError:
        return
    RecApplicationStage.__table__.drop(bind=op.get_bind(), checkfirst=True)
