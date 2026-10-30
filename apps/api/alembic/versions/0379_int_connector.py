"""Create IntConnector table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0379_int_connector"
down_revision: str | None = "0378_int_external_system"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.connector import IntConnector  # noqa: F401
    except ModuleNotFoundError:
        return
    IntConnector.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.connector import IntConnector  # noqa: F401
    except ModuleNotFoundError:
        return
    IntConnector.__table__.drop(bind=op.get_bind(), checkfirst=True)
