"""Create PtServiceRequest table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.service_request import PtServiceRequest  # noqa: F401

revision: str = "0433_pt_service_request"
down_revision: str | None = "0432_pt_support_ticket"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtServiceRequest.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtServiceRequest.__table__.drop(bind=op.get_bind(), checkfirst=True)
