"""Create PtCustomerProfile table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0423_pt_customer_profile"
down_revision: str | None = "0422_pt_portal_account"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.customer_profile import PtCustomerProfile  # noqa: F401
    except ModuleNotFoundError:
        return
    PtCustomerProfile.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.customer_profile import PtCustomerProfile  # noqa: F401
    except ModuleNotFoundError:
        return
    PtCustomerProfile.__table__.drop(bind=op.get_bind(), checkfirst=True)
