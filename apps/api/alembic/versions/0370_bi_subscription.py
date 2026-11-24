"""Create BiSubscription table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0370_bi_subscription"
down_revision: str | None = "0369_bi_alert_notification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.subscription import BiSubscription  # noqa: F401
    except ModuleNotFoundError:
        return
    BiSubscription.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.subscription import BiSubscription  # noqa: F401
    except ModuleNotFoundError:
        return
    BiSubscription.__table__.drop(bind=op.get_bind(), checkfirst=True)
