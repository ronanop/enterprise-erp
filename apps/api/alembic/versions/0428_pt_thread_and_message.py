"""Create portal dual-table migration."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.message_thread import PtMessageThread  # noqa: F401
from modules.portal.models.message import PtMessage  # noqa: F401

revision: str = "0428_pt_thread_and_message"
down_revision: str | None = "0427_pt_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtMessageThread.__table__.create(bind=op.get_bind(), checkfirst=True)
    PtMessage.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtMessage.__table__.drop(bind=op.get_bind(), checkfirst=True)
    PtMessageThread.__table__.drop(bind=op.get_bind(), checkfirst=True)
