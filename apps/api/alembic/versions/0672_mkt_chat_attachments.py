"""Marketing chat attachments for multimodal ChatGPT-style files."""

from collections.abc import Sequence

from alembic import op

from modules.marketing.models.chat_session import MktChatAttachment

revision: str = "0672_mkt_chat_attachments"
down_revision: str | Sequence[str] | None = "0671_mkt_chat_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS marketing")
    bind = op.get_bind()
    MktChatAttachment.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    MktChatAttachment.__table__.drop(bind=bind, checkfirst=True)
