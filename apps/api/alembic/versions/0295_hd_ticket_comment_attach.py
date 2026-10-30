"""Create helpdesk ticket comment and attachment tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0295_hd_ticket_comment_attach"
down_revision: str | None = "0294_hd_ticket_status_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_comment import HdTicketComment  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketComment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_comment import HdTicketComment  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketComment.__table__.drop(bind=op.get_bind(), checkfirst=True)
