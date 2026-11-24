"""Create project graph tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0228_prj_task_dep_assign"
down_revision: str | None = "0227_prj_project_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.task_dependency import PrjTaskDependency  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjTaskDependency.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.task_dependency import PrjTaskDependency  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjTaskDependency.__table__.drop(bind=op.get_bind(), checkfirst=True)
