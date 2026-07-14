"""Create CrmPipeline table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.pipeline import CrmPipeline  # noqa: F401

revision: str = "0138_crm_pipeline"
down_revision: str | None = "0137_crm_lead_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmPipeline.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmPipeline.__table__.drop(bind=op.get_bind(), checkfirst=True)
