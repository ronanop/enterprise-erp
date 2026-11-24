"""Create BiAlertNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0369_bi_alert_notification"
down_revision: str | None = "0368_bi_alert_rule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.alert_notification import BiAlertNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    BiAlertNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.alert_notification import BiAlertNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    BiAlertNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
