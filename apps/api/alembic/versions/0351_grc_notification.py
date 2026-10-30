"""Create GrcNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0351_grc_notification"
down_revision: str | None = "0350_grc_incident"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.notification import GrcNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.notification import GrcNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
