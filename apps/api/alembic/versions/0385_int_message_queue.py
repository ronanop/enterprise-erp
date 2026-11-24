"""Create IntMessageQueue table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0385_int_message_queue"
down_revision: str | None = "0384_int_event_subscription"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.message_queue import IntMessageQueue  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMessageQueue.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.message_queue import IntMessageQueue  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMessageQueue.__table__.drop(bind=op.get_bind(), checkfirst=True)
