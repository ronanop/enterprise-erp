"""Create bi_dataset and bi_dataset_source tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.dataset import BiDataset  # noqa: F401
from modules.analytics.models.dataset_source import BiDatasetSource  # noqa: F401

revision: str = "0361_bi_dataset_and_source"
down_revision: str | None = "0360_bi_report_execution"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    BiDataset.__table__.create(bind=op.get_bind(), checkfirst=True)
    BiDatasetSource.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    BiDatasetSource.__table__.drop(bind=op.get_bind(), checkfirst=True)
    BiDataset.__table__.drop(bind=op.get_bind(), checkfirst=True)
