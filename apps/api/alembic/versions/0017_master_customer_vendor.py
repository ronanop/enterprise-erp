"""Create master_customer and master_vendor tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0017_master_customer_vendor"
down_revision: str | None = "0016_master_employee"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.master_data.models.party import MasterCustomer, MasterVendor  # noqa: F401
    except ModuleNotFoundError:
        return
    bind = op.get_bind()
    MasterCustomer.__table__.create(bind=bind, checkfirst=True)
    MasterVendor.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.party import MasterCustomer, MasterVendor  # noqa: F401
    except ModuleNotFoundError:
        return
    bind = op.get_bind()
    MasterVendor.__table__.drop(bind=bind, checkfirst=True)
    MasterCustomer.__table__.drop(bind=bind, checkfirst=True)
