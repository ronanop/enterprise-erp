"""Create document tag and tag_map tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.models.document_tag import DocDocumentTag  # noqa: F401
from modules.document.models.document_tag_map import DocDocumentTagMap  # noqa: F401

revision: str = "0316_doc_tag_and_map"
down_revision: str | None = "0315_doc_document_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    DocDocumentTag.__table__.create(bind=op.get_bind(), checkfirst=True)
    DocDocumentTagMap.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    DocDocumentTagMap.__table__.drop(bind=op.get_bind(), checkfirst=True)
    DocDocumentTag.__table__.drop(bind=op.get_bind(), checkfirst=True)
