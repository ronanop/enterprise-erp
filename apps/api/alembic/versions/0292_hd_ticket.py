"""Create HdTicket table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0292_hd_ticket"
down_revision: str | None = "0291_hd_ticket_priority"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.ticket import HdTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicket.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.ticket import HdTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    HdTicket.__table__.drop(bind=op.get_bind(), checkfirst=True)
