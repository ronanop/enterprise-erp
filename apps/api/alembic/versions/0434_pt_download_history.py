"""Create PtDownloadHistory table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.download_history import PtDownloadHistory  # noqa: F401

revision: str = "0434_pt_download_history"
down_revision: str | None = "0433_pt_service_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtDownloadHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtDownloadHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
