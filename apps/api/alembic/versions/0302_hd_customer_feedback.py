"""Create HdCustomerFeedback table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.customer_feedback import HdCustomerFeedback  # noqa: F401

revision: str = "0302_hd_customer_feedback"
down_revision: str | None = "0301_hd_resolution"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdCustomerFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdCustomerFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
