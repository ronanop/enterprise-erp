"""Create QmSupplierQuality table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.supplier_quality import QmSupplierQuality  # noqa: F401

revision: str = "0130_qm_supplier_quality"
down_revision: str | None = "0129_qm_preventive_action"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmSupplierQuality.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmSupplierQuality.__table__.drop(bind=op.get_bind(), checkfirst=True)
