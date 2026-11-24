"""Create PrjProjectMilestone table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0226_prj_project_milestone"
down_revision: str | None = "0225_prj_project_phase"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_milestone import PrjProjectMilestone  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectMilestone.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_milestone import PrjProjectMilestone  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectMilestone.__table__.drop(bind=op.get_bind(), checkfirst=True)
