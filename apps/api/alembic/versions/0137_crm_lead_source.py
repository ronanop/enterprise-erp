"""Create CrmLeadSource table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.lead_source import CrmLeadSource  # noqa: F401

revision: str = "0137_crm_lead_source"
down_revision: str | None = "0136_create_crm_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmLeadSource.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmLeadSource.__table__.drop(bind=op.get_bind(), checkfirst=True)
