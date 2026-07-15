"""Create HdTicketAssignment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_assignment import HdTicketAssignment  # noqa: F401

revision: str = "0293_hd_ticket_assignment"
down_revision: str | None = "0292_hd_ticket"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
