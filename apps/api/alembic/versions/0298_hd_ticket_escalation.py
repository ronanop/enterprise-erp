"""Create HdTicketEscalation table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_escalation import HdTicketEscalation  # noqa: F401

revision: str = "0298_hd_ticket_escalation"
down_revision: str | None = "0297_hd_ticket_sla"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketEscalation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketEscalation.__table__.drop(bind=op.get_bind(), checkfirst=True)
