"""Create PtDownloadHistory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0434_pt_download_history"
down_revision: str | None = "0433_pt_service_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.download_history import PtDownloadHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    PtDownloadHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.download_history import PtDownloadHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    PtDownloadHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
