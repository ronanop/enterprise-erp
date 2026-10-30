"""Create PrjProjectComment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0239_prj_project_comment"
down_revision: str | None = "0238_prj_project_document"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_comment import PrjProjectComment  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectComment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_comment import PrjProjectComment  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectComment.__table__.drop(bind=op.get_bind(), checkfirst=True)
