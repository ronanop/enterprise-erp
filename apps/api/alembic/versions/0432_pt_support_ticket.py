"""Create PtSupportTicket table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0432_pt_support_ticket"
down_revision: str | None = "0431_pt_document_access"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.support_ticket import PtSupportTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSupportTicket.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.support_ticket import PtSupportTicket  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSupportTicket.__table__.drop(bind=op.get_bind(), checkfirst=True)
