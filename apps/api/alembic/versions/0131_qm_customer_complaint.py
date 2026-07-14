"""Create QmCustomerComplaint table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.customer_complaint import QmCustomerComplaint  # noqa: F401

revision: str = "0131_qm_customer_complaint"
down_revision: str | None = "0130_qm_supplier_quality"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmCustomerComplaint.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmCustomerComplaint.__table__.drop(bind=op.get_bind(), checkfirst=True)
