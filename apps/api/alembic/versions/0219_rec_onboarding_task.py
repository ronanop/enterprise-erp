"""Create RecOnboardingTask table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0219_rec_onboarding_task"
down_revision: str | None = "0218_rec_onboarding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.onboarding_task import RecOnboardingTask  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOnboardingTask.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.onboarding_task import RecOnboardingTask  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOnboardingTask.__table__.drop(bind=op.get_bind(), checkfirst=True)
