"""Create BiMetric table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0362_bi_metric"
down_revision: str | None = "0361_bi_dataset_and_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.metric import BiMetric  # noqa: F401
    except ModuleNotFoundError:
        return
    BiMetric.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.metric import BiMetric  # noqa: F401
    except ModuleNotFoundError:
        return
    BiMetric.__table__.drop(bind=op.get_bind(), checkfirst=True)
