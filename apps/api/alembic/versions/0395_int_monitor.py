"""Create IntMonitor table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0395_int_monitor"
down_revision: str | None = "0394_int_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.monitor import IntMonitor  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMonitor.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.monitor import IntMonitor  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMonitor.__table__.drop(bind=op.get_bind(), checkfirst=True)
