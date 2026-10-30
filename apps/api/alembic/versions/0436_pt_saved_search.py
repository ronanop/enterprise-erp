"""Create PtSavedSearch table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0436_pt_saved_search"
down_revision: str | None = "0435_pt_saved_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.saved_search import PtSavedSearch  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSavedSearch.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.saved_search import PtSavedSearch  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSavedSearch.__table__.drop(bind=op.get_bind(), checkfirst=True)
