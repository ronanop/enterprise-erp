"""Create PrjProjectNotification table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0241_prj_project_notification"
down_revision: str | None = "0240_prj_project_status_hist"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_notification import PrjProjectNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectNotification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_notification import PrjProjectNotification  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectNotification.__table__.drop(bind=op.get_bind(), checkfirst=True)
