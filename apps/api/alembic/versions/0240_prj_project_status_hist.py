"""Create PrjProjectStatusHistory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0240_prj_project_status_hist"
down_revision: str | None = "0239_prj_project_comment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_status_history import PrjProjectStatusHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectStatusHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_status_history import PrjProjectStatusHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectStatusHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
