"""Create PtSavedReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0435_pt_saved_report"
down_revision: str | None = "0434_pt_download_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.saved_report import PtSavedReport  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSavedReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.saved_report import PtSavedReport  # noqa: F401
    except ModuleNotFoundError:
        return
    PtSavedReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
