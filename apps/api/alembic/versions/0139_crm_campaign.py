"""Create CrmCampaign table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.campaign import CrmCampaign  # noqa: F401

revision: str = "0139_crm_campaign"
down_revision: str | None = "0138_crm_pipeline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmCampaign.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmCampaign.__table__.drop(bind=op.get_bind(), checkfirst=True)
