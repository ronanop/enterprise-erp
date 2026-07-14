"""Create CrmCustomerSatisfaction table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.customer_satisfaction import CrmCustomerSatisfaction  # noqa: F401

revision: str = "0154_crm_customer_satisfaction"
down_revision: str | None = "0153_crm_customer_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmCustomerSatisfaction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmCustomerSatisfaction.__table__.drop(bind=op.get_bind(), checkfirst=True)
