"""Create DocDocumentAudit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0323_doc_document_audit"
down_revision: str | None = "0322_doc_document_checkout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.document_audit import DocDocumentAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentAudit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.document_audit import DocDocumentAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    DocDocumentAudit.__table__.drop(bind=op.get_bind(), checkfirst=True)
