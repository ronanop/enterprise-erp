"""Create RecOffer table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0212_rec_offer"
down_revision: str | None = "0211_rec_interview_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.offer import RecOffer  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOffer.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.offer import RecOffer  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOffer.__table__.drop(bind=op.get_bind(), checkfirst=True)
