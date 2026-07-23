"""Create CrmMeeting table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.meeting import CrmMeeting  # noqa: F401,E402

revision: str = "0149_crm_meeting"
down_revision: str | None = "0148_crm_followup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmMeeting.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmMeeting.__table__.drop(bind=op.get_bind(), checkfirst=True)
