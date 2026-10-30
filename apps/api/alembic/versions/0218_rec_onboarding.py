"""Create RecOnboarding table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0218_rec_onboarding"
down_revision: str | None = "0217_rec_candidate_note"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.onboarding import RecOnboarding  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOnboarding.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.onboarding import RecOnboarding  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOnboarding.__table__.drop(bind=op.get_bind(), checkfirst=True)
