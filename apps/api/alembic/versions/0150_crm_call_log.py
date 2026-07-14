"""Create CrmCallLog table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.call_log import CrmCallLog  # noqa: F401

revision: str = "0150_crm_call_log"
down_revision: str | None = "0149_crm_meeting"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmCallLog.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmCallLog.__table__.drop(bind=op.get_bind(), checkfirst=True)
