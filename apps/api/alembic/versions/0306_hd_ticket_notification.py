"""Create HdTicketNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0306_hd_ticket_notification"
down_revision: str | None = "0305_hd_support_schedule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_notification import HdTicketNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_notification import HdTicketNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
