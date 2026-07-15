"""Create HdKnowledgeArticle table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.models.knowledge_article import HdKnowledgeArticle  # noqa: F401

revision: str = "0300_hd_knowledge_article"
down_revision: str | None = "0299_hd_knowledge_base"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HdKnowledgeArticle.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HdKnowledgeArticle.__table__.drop(bind=op.get_bind(), checkfirst=True)
