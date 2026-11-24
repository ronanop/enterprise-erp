"""Marketing chat sessions + messages for ChatGPT history."""

from collections.abc import Sequence

from alembic import op

from modules.marketing.models.chat_session import MktChatMessage, MktChatSession

revision: str = "0671_mkt_chat_sessions"
down_revision: str | Sequence[str] | None = "0670_restore_marketing_module"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS marketing")
    bind = op.get_bind()
    MktChatSession.__table__.create(bind=bind, checkfirst=True)
    MktChatMessage.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    MktChatMessage.__table__.drop(bind=bind, checkfirst=True)
    MktChatSession.__table__.drop(bind=bind, checkfirst=True)
