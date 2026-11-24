"""Create PtOrderView table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0429_pt_order_view"
down_revision: str | None = "0428_pt_thread_and_message"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.order_view import PtOrderView  # noqa: F401
    except ModuleNotFoundError:
        return
    PtOrderView.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.order_view import PtOrderView  # noqa: F401
    except ModuleNotFoundError:
        return
    PtOrderView.__table__.drop(bind=op.get_bind(), checkfirst=True)
