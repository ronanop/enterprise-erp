"""Create QmWarrantyClaim table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.quality.models.warranty_claim import QmWarrantyClaim  # noqa: F401

revision: str = "0508_qm_warranty_claim"
down_revision: str | None = "0507_seed_qm_vin_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    QmWarrantyClaim.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    QmWarrantyClaim.__table__.drop(bind=op.get_bind(), checkfirst=True)
