"""Create GrcIncident table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0350_grc_incident"
down_revision: str | None = "0349_grc_exception"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.incident import GrcIncident  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcIncident.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.incident import GrcIncident  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcIncident.__table__.drop(bind=op.get_bind(), checkfirst=True)
