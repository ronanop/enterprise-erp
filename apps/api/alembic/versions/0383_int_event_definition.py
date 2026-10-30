"""Create IntEventDefinition table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0383_int_event_definition"
down_revision: str | None = "0382_int_webhook"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.event_definition import IntEventDefinition  # noqa: F401
    except ModuleNotFoundError:
        return
    IntEventDefinition.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.event_definition import IntEventDefinition  # noqa: F401
    except ModuleNotFoundError:
        return
    IntEventDefinition.__table__.drop(bind=op.get_bind(), checkfirst=True)
