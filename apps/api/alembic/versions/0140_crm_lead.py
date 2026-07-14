"""Create CrmLead table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.lead import CrmLead  # noqa: F401

revision: str = "0140_crm_lead"
down_revision: str | None = "0139_crm_campaign"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmLead.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmLead.__table__.drop(bind=op.get_bind(), checkfirst=True)
