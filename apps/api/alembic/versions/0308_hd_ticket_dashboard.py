"""Create HdTicketDashboard table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0308_hd_ticket_dashboard"
down_revision: str | None = "0307_hd_ticket_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_dashboard import HdTicketDashboard  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketDashboard.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_dashboard import HdTicketDashboard  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketDashboard.__table__.drop(bind=op.get_bind(), checkfirst=True)
