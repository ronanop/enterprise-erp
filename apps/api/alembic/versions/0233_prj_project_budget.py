"""Create PrjProjectBudget table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0233_prj_project_budget"
down_revision: str | None = "0232_prj_resource_allocation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_budget import PrjProjectBudget  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectBudget.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_budget import PrjProjectBudget  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectBudget.__table__.drop(bind=op.get_bind(), checkfirst=True)
