"""Create document tag and tag_map tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0316_doc_tag_and_map"
down_revision: str | None = "0315_doc_document_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document_tag import DocDocumentTag  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentTag.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document_tag import DocDocumentTag  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentTag.__table__.drop(bind=op.get_bind(), checkfirst=True)
