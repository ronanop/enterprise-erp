"""Create DocDocumentVersion table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0314_doc_document_version"
down_revision: str | None = "0313_doc_document"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document_version import DocDocumentVersion  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentVersion.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document_version import DocDocumentVersion  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentVersion.__table__.drop(bind=op.get_bind(), checkfirst=True)
