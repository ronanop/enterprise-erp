"""Create HdSupportSchedule table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0305_hd_support_schedule"
down_revision: str | None = "0304_hd_support_shift"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.support_schedule import HdSupportSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportSchedule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.support_schedule import HdSupportSchedule  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportSchedule.__table__.drop(bind=op.get_bind(), checkfirst=True)
