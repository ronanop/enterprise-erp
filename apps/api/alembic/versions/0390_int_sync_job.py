"""Create IntSyncJob table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0390_int_sync_job"
down_revision: str | None = "0389_int_data_transformation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.sync_job import IntSyncJob  # noqa: F401
    except ModuleNotFoundError:
        return
    IntSyncJob.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.sync_job import IntSyncJob  # noqa: F401
    except ModuleNotFoundError:
        return
    IntSyncJob.__table__.drop(bind=op.get_bind(), checkfirst=True)
