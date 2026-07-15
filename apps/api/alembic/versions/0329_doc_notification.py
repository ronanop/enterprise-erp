"""Create DocNotification table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.notification import DocNotification  # noqa: F401

revision: str = "0329_doc_notification"
down_revision: str | None = "0328_doc_archive"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
