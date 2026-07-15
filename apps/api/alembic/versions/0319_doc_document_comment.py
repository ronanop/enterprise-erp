"""Create DocDocumentComment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.document_comment import DocDocumentComment  # noqa: F401

revision: str = "0319_doc_document_comment"
down_revision: str | None = "0318_doc_document_share"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocDocumentComment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocDocumentComment.__table__.drop(bind=op.get_bind(), checkfirst=True)
