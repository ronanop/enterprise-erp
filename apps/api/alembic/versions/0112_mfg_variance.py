"""Create MfgVariance table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0112_mfg_variance"
down_revision: str | None = "0111_mfg_scrap"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.variance import MfgVariance  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgVariance.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.variance import MfgVariance  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgVariance.__table__.drop(bind=op.get_bind(), checkfirst=True)
