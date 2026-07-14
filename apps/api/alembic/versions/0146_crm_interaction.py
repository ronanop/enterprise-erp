"""Create CrmInteraction table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.interaction import CrmInteraction  # noqa: F401

revision: str = "0146_crm_interaction"
down_revision: str | None = "0145_crm_campaign_member"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmInteraction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmInteraction.__table__.drop(bind=op.get_bind(), checkfirst=True)
