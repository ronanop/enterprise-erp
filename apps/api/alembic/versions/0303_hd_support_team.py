"""Create HdSupportTeam table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0303_hd_support_team"
down_revision: str | None = "0302_hd_customer_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.support_team import HdSupportTeam  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportTeam.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.support_team import HdSupportTeam  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportTeam.__table__.drop(bind=op.get_bind(), checkfirst=True)
