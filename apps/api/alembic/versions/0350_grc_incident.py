"""Create GrcIncident table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.incident import GrcIncident  # noqa: F401

revision: str = "0350_grc_incident"
down_revision: str | None = "0349_grc_exception"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcIncident.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcIncident.__table__.drop(bind=op.get_bind(), checkfirst=True)
