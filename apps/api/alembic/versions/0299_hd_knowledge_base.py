"""Create HdKnowledgeBase table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0299_hd_knowledge_base"
down_revision: str | None = "0298_hd_ticket_escalation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.helpdesk.models.knowledge_base import HdKnowledgeBase  # noqa: F401
    except ModuleNotFoundError:
        return
    HdKnowledgeBase.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.helpdesk.models.knowledge_base import HdKnowledgeBase  # noqa: F401
    except ModuleNotFoundError:
        return
    HdKnowledgeBase.__table__.drop(bind=op.get_bind(), checkfirst=True)
