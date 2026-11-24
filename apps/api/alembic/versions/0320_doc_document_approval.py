"""Create DocDocumentApproval table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0320_doc_document_approval"
down_revision: str | None = "0319_doc_document_comment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document_approval import DocDocumentApproval  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentApproval.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document_approval import DocDocumentApproval  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentApproval.__table__.drop(bind=op.get_bind(), checkfirst=True)
