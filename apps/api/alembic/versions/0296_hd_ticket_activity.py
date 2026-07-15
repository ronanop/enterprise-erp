"""Create HdTicketActivity table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_activity import HdTicketActivity  # noqa: F401

revision: str = "0296_hd_ticket_activity"
down_revision: str | None = "0295_hd_ticket_comment_attach"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketActivity.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketActivity.__table__.drop(bind=op.get_bind(), checkfirst=True)
