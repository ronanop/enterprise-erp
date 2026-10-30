"""Create EcNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0417_ec_notification"
down_revision: str | None = "0416_ec_marketplace_connector"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.ecommerce.models.notification import EcNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    EcNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.ecommerce.models.notification import EcNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    EcNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
