"""Create HdKnowledgeArticle table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0300_hd_knowledge_article"
down_revision: str | None = "0299_hd_knowledge_base"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.knowledge_article import HdKnowledgeArticle  # noqa: F401
    except ModuleNotFoundError:
        return
    HdKnowledgeArticle.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.knowledge_article import HdKnowledgeArticle  # noqa: F401
    except ModuleNotFoundError:
        return
    HdKnowledgeArticle.__table__.drop(bind=op.get_bind(), checkfirst=True)
