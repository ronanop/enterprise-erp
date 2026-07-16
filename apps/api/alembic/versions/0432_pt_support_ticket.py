"""Create PtSupportTicket table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.support_ticket import PtSupportTicket  # noqa: F401

revision: str = "0432_pt_support_ticket"
down_revision: str | None = "0431_pt_document_access"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtSupportTicket.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtSupportTicket.__table__.drop(bind=op.get_bind(), checkfirst=True)
