"""Create PrjProjectRisk table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0236_prj_project_risk"
down_revision: str | None = "0235_prj_project_issue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_risk import PrjProjectRisk  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectRisk.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_risk import PrjProjectRisk  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectRisk.__table__.drop(bind=op.get_bind(), checkfirst=True)
