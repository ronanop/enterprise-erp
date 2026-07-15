"""Create DocArchive table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.archive import DocArchive  # noqa: F401

revision: str = "0328_doc_archive"
down_revision: str | None = "0327_doc_retention_policy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocArchive.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocArchive.__table__.drop(bind=op.get_bind(), checkfirst=True)
