"""Create BiAlertRule table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0368_bi_alert_rule"
down_revision: str | None = "0367_bi_data_refresh"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.alert_rule import BiAlertRule  # noqa: F401
    except ModuleNotFoundError:
        return
    BiAlertRule.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.alert_rule import BiAlertRule  # noqa: F401
    except ModuleNotFoundError:
        return
    BiAlertRule.__table__.drop(bind=op.get_bind(), checkfirst=True)
