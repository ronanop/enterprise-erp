"""Create IntSyncLog table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0391_int_sync_log"
down_revision: str | None = "0390_int_sync_job"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.sync_log import IntSyncLog  # noqa: F401
    except ModuleNotFoundError:
        return
    IntSyncLog.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.sync_log import IntSyncLog  # noqa: F401
    except ModuleNotFoundError:
        return
    IntSyncLog.__table__.drop(bind=op.get_bind(), checkfirst=True)
