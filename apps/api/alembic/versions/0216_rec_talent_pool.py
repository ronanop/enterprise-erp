"""Create RecTalentPool table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0216_rec_talent_pool"
down_revision: str | None = "0215_rec_reference_check"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.talent_pool import RecTalentPool  # noqa: F401
    except ModuleNotFoundError:
        return
    RecTalentPool.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.talent_pool import RecTalentPool  # noqa: F401
    except ModuleNotFoundError:
        return
    RecTalentPool.__table__.drop(bind=op.get_bind(), checkfirst=True)
