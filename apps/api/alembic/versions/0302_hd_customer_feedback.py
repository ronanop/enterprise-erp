"""Create HdCustomerFeedback table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0302_hd_customer_feedback"
down_revision: str | None = "0301_hd_resolution"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.customer_feedback import HdCustomerFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    HdCustomerFeedback.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.customer_feedback import HdCustomerFeedback  # noqa: F401
    except ModuleNotFoundError:
        return
    HdCustomerFeedback.__table__.drop(bind=op.get_bind(), checkfirst=True)
