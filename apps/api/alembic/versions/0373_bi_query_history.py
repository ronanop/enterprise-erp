"""Create BiQueryHistory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0373_bi_query_history"
down_revision: str | None = "0372_bi_data_import"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.query_history import BiQueryHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    BiQueryHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.query_history import BiQueryHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    BiQueryHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
