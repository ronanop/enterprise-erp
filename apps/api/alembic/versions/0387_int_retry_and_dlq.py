"""Create int_retry_queue and int_dead_letter tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0387_int_retry_and_dlq"
down_revision: str | None = "0386_int_message"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.retry_queue import IntRetryQueue  # noqa: F401
    except ModuleNotFoundError:
        return
    IntRetryQueue.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.retry_queue import IntRetryQueue  # noqa: F401
    except ModuleNotFoundError:
        return
    IntRetryQueue.__table__.drop(bind=op.get_bind(), checkfirst=True)
