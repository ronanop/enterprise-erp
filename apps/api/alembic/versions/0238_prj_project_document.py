"""Create PrjProjectDocument table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0238_prj_project_document"
down_revision: str | None = "0237_prj_change_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.project_document import PrjProjectDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.project_document import PrjProjectDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjProjectDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
