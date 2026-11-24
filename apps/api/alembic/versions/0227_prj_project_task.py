"""Create PrjProjectTask table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0227_prj_project_task"
down_revision: str | None = "0226_prj_project_milestone"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_task import PrjProjectTask  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectTask.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_task import PrjProjectTask  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectTask.__table__.drop(bind=op.get_bind(), checkfirst=True)
