"""Create bi_dataset and bi_dataset_source tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0361_bi_dataset_and_source"
down_revision: str | None = "0360_bi_report_execution"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.dataset import BiDataset  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataset.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.dataset import BiDataset  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataset.__table__.drop(bind=op.get_bind(), checkfirst=True)
