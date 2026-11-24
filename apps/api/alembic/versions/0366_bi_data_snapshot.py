"""Create BiDataSnapshot table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0366_bi_data_snapshot"
down_revision: str | None = "0365_bi_fact_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.data_snapshot import BiDataSnapshot  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataSnapshot.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.data_snapshot import BiDataSnapshot  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataSnapshot.__table__.drop(bind=op.get_bind(), checkfirst=True)
