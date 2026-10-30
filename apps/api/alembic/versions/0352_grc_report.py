"""Create GrcReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0352_grc_report"
down_revision: str | None = "0351_grc_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.report import GrcReport  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.report import GrcReport  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
