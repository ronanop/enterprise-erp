"""Create CrmCustomerFeedback table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.customer_feedback import CrmCustomerFeedback  # noqa: F401

revision: str = "0153_crm_customer_feedback"
down_revision: str | None = "0152_crm_visit_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmCustomerFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmCustomerFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
