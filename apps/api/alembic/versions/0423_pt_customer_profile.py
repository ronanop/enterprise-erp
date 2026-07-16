"""Create PtCustomerProfile table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.customer_profile import PtCustomerProfile  # noqa: F401

revision: str = "0423_pt_customer_profile"
down_revision: str | None = "0422_pt_portal_account"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtCustomerProfile.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtCustomerProfile.__table__.drop(bind=op.get_bind(), checkfirst=True)
