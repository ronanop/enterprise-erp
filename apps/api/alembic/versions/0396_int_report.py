"""Create IntReport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0396_int_report"
down_revision: str | None = "0395_int_monitor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.report import IntReport  # noqa: F401
    except ModuleNotFoundError:
        return
    IntReport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.report import IntReport  # noqa: F401
    except ModuleNotFoundError:
        return
    IntReport.__table__.drop(bind=op.get_bind(), checkfirst=True)
