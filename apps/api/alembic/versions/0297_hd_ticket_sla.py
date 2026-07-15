"""Create HdTicketSla table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_sla import HdTicketSla  # noqa: F401

revision: str = "0297_hd_ticket_sla"
down_revision: str | None = "0296_hd_ticket_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketSla.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketSla.__table__.drop(bind=op.get_bind(), checkfirst=True)
