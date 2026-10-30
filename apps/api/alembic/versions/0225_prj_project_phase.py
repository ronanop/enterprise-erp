"""Create PrjProjectPhase table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0225_prj_project_phase"
down_revision: str | None = "0224_prj_project"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_phase import PrjProjectPhase  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectPhase.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_phase import PrjProjectPhase  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectPhase.__table__.drop(bind=op.get_bind(), checkfirst=True)
