"""Create IntMessage table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0386_int_message"
down_revision: str | None = "0385_int_message_queue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.message import IntMessage  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMessage.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.message import IntMessage  # noqa: F401
    except ModuleNotFoundError:
        return
    IntMessage.__table__.drop(bind=op.get_bind(), checkfirst=True)
