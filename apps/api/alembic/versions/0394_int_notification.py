"""Create IntNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0394_int_notification"
down_revision: str | None = "0393_int_rate_limit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.notification import IntNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    IntNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.notification import IntNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    IntNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
