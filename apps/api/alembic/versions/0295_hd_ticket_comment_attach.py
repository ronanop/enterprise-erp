"""Create helpdesk ticket comment and attachment tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.ticket_comment import HdTicketComment  # noqa: F401
from modules.helpdesk.models.ticket_attachment import HdTicketAttachment  # noqa: F401

revision: str = "0295_hd_ticket_comment_attach"
down_revision: str | None = "0294_hd_ticket_status_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdTicketComment.__table__.create(bind=op.get_bind(), checkfirst=True)
    HdTicketAttachment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdTicketAttachment.__table__.drop(bind=op.get_bind(), checkfirst=True)
    HdTicketComment.__table__.drop(bind=op.get_bind(), checkfirst=True)
