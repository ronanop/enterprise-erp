"""Create DocDocumentAudit table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.document_audit import DocDocumentAudit  # noqa: F401

revision: str = "0323_doc_document_audit"
down_revision: str | None = "0322_doc_document_checkout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocDocumentAudit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocDocumentAudit.__table__.drop(bind=op.get_bind(), checkfirst=True)
