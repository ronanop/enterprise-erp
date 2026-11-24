"""Create IntApiUsage table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0392_int_api_usage"
down_revision: str | None = "0391_int_sync_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.api_usage import IntApiUsage  # noqa: F401
    except ModuleNotFoundError:
        return
    IntApiUsage.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.api_usage import IntApiUsage  # noqa: F401
    except ModuleNotFoundError:
        return
    IntApiUsage.__table__.drop(bind=op.get_bind(), checkfirst=True)
