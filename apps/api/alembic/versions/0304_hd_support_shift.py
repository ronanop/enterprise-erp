"""Create HdSupportShift table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0304_hd_support_shift"
down_revision: str | None = "0303_hd_support_team"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.support_shift import HdSupportShift  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportShift.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.support_shift import HdSupportShift  # noqa: F401
    except ModuleNotFoundError:
        return
    HdSupportShift.__table__.drop(bind=op.get_bind(), checkfirst=True)
