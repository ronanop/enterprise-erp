"""Create PrjProjectCost table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0234_prj_project_cost"
down_revision: str | None = "0233_prj_project_budget"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_cost import PrjProjectCost  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectCost.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_cost import PrjProjectCost  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectCost.__table__.drop(bind=op.get_bind(), checkfirst=True)
