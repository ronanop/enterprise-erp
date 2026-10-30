"""Create HdResolution table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0301_hd_resolution"
down_revision: str | None = "0300_hd_knowledge_article"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.resolution import HdResolution  # noqa: F401
    except ModuleNotFoundError:
        return
    HdResolution.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.resolution import HdResolution  # noqa: F401
    except ModuleNotFoundError:
        return
    HdResolution.__table__.drop(bind=op.get_bind(), checkfirst=True)
