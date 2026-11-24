"""Create EcReturnRequest table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0412_ec_return_request"
down_revision: str | None = "0411_ec_shipment_and_tracking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.return_request import EcReturnRequest  # noqa: F401
    except ModuleNotFoundError:
        return
    EcReturnRequest.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.return_request import EcReturnRequest  # noqa: F401
    except ModuleNotFoundError:
        return
    EcReturnRequest.__table__.drop(bind=op.get_bind(), checkfirst=True)
