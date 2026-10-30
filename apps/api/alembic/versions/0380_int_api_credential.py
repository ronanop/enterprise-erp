"""Create IntApiCredential table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0380_int_api_credential"
down_revision: str | None = "0379_int_connector"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.api_credential import IntApiCredential  # noqa: F401
    except ModuleNotFoundError:
        return
    IntApiCredential.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.api_credential import IntApiCredential  # noqa: F401
    except ModuleNotFoundError:
        return
    IntApiCredential.__table__.drop(bind=op.get_bind(), checkfirst=True)
