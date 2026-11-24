"""Create IntWebhook table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0382_int_webhook"
down_revision: str | None = "0381_int_oauth_client"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.webhook import IntWebhook  # noqa: F401
    except ModuleNotFoundError:
        return
    IntWebhook.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.webhook import IntWebhook  # noqa: F401
    except ModuleNotFoundError:
        return
    IntWebhook.__table__.drop(bind=op.get_bind(), checkfirst=True)
