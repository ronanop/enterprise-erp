"""Create DocDocumentMetadata table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.document_metadata import DocDocumentMetadata  # noqa: F401

revision: str = "0315_doc_document_metadata"
down_revision: str | None = "0314_doc_document_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocDocumentMetadata.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocDocumentMetadata.__table__.drop(bind=op.get_bind(), checkfirst=True)
