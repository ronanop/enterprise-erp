"""Create RecOfferApproval table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0213_rec_offer_approval"
down_revision: str | None = "0212_rec_offer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.offer_approval import RecOfferApproval  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOfferApproval.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.offer_approval import RecOfferApproval  # noqa: F401
    except ModuleNotFoundError:
        return
    RecOfferApproval.__table__.drop(bind=op.get_bind(), checkfirst=True)
