"""Create HdTicketActivity table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0296_hd_ticket_activity"
down_revision: str | None = "0295_hd_ticket_comment_attach"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_activity import HdTicketActivity  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketActivity.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket_activity import HdTicketActivity  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicketActivity.__table__.drop(bind=op.get_bind(), checkfirst=True)
