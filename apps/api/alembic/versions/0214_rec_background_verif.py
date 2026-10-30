"""Create RecBackgroundVerification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0214_rec_background_verif"
down_revision: str | None = "0213_rec_offer_approval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.background_verification import RecBackgroundVerification  # noqa: F401
    except ModuleNotFoundError:
        return
    RecBackgroundVerification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.background_verification import RecBackgroundVerification  # noqa: F401
    except ModuleNotFoundError:
        return
    RecBackgroundVerification.__table__.drop(bind=op.get_bind(), checkfirst=True)
