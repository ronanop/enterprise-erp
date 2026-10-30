"""Create DocDocument table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0313_doc_document"
down_revision: str | None = "0312_doc_folder"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document import DocDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document import DocDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
