"""Create IntRateLimit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0393_int_rate_limit"
down_revision: str | None = "0392_int_api_usage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.rate_limit import IntRateLimit  # noqa: F401
    except ModuleNotFoundError:
        return
    IntRateLimit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.rate_limit import IntRateLimit  # noqa: F401
    except ModuleNotFoundError:
        return
    IntRateLimit.__table__.drop(bind=op.get_bind(), checkfirst=True)
