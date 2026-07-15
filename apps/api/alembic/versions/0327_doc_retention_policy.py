"""Create DocRetentionPolicy table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.retention_policy import DocRetentionPolicy  # noqa: F401

revision: str = "0327_doc_retention_policy"
down_revision: str | None = "0326_doc_template_field"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocRetentionPolicy.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocRetentionPolicy.__table__.drop(bind=op.get_bind(), checkfirst=True)
