"""Create HdTicketDashboard table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_dashboard import HdTicketDashboard  # noqa: F401

revision: str = "0308_hd_ticket_dashboard"
down_revision: str | None = "0307_hd_ticket_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketDashboard.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketDashboard.__table__.drop(bind=op.get_bind(), checkfirst=True)
