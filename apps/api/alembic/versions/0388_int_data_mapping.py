"""Create IntDataMapping table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0388_int_data_mapping"
down_revision: str | None = "0387_int_retry_and_dlq"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.data_mapping import IntDataMapping  # noqa: F401
    except ModuleNotFoundError:
        return
    IntDataMapping.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.data_mapping import IntDataMapping  # noqa: F401
    except ModuleNotFoundError:
        return
    IntDataMapping.__table__.drop(bind=op.get_bind(), checkfirst=True)
