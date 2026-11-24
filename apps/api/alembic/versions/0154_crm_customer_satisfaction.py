"""Create CrmCustomerSatisfaction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0154_crm_customer_satisfaction"
down_revision: str | None = "0153_crm_customer_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.customer_satisfaction import CrmCustomerSatisfaction  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCustomerSatisfaction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.customer_satisfaction import CrmCustomerSatisfaction  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCustomerSatisfaction.__table__.drop(bind=op.get_bind(), checkfirst=True)
