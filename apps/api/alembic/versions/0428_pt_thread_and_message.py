"""Create portal dual-table migration."""

from collections.abc import Sequence

from alembic import op

revision: str = "0428_pt_thread_and_message"
down_revision: str | None = "0427_pt_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.message_thread import PtMessageThread  # noqa: F401
    except ModuleNotFoundError:
        return
    PtMessageThread.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.message_thread import PtMessageThread  # noqa: F401
    except ModuleNotFoundError:
        return
    PtMessageThread.__table__.drop(bind=op.get_bind(), checkfirst=True)
