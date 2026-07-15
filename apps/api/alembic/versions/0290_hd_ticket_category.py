"""Create HdTicketCategory table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_category import HdTicketCategory  # noqa: F401

revision: str = "0290_hd_ticket_category"
down_revision: str | None = "0289_create_helpdesk_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
