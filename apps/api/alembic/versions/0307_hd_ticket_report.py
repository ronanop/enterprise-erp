"""Create HdTicketReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0307_hd_ticket_report"
down_revision: str | None = "0306_hd_ticket_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_report import HdTicketReport  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_report import HdTicketReport  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
