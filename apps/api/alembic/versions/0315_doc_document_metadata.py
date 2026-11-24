"""Create DocDocumentMetadata table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0315_doc_document_metadata"
down_revision: str | None = "0314_doc_document_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document_metadata import DocDocumentMetadata  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentMetadata.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document_metadata import DocDocumentMetadata  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentMetadata.__table__.drop(bind=op.get_bind(), checkfirst=True)
