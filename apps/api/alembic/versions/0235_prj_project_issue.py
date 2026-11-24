"""Create PrjProjectIssue table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0235_prj_project_issue"
down_revision: str | None = "0234_prj_project_cost"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_issue import PrjProjectIssue  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectIssue.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_issue import PrjProjectIssue  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectIssue.__table__.drop(bind=op.get_bind(), checkfirst=True)
