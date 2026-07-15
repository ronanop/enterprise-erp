"""Create HdResolution table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.resolution import HdResolution  # noqa: F401

revision: str = "0301_hd_resolution"
down_revision: str | None = "0300_hd_knowledge_article"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdResolution.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdResolution.__table__.drop(bind=op.get_bind(), checkfirst=True)
