"""Create HR workplace feed tables for company-wide ESS social timeline."""

from collections.abc import Sequence

from alembic import op

from modules.hr.models.workplace_feed import (
    HrWorkplaceFeedComment,
    HrWorkplaceFeedLike,
    HrWorkplaceFeedPost,
)

revision: str = "0673_hr_workplace_feed"
down_revision: str | Sequence[str] | None = "0672_mkt_chat_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS hr")
    bind = op.get_bind()
    HrWorkplaceFeedPost.__table__.create(bind=bind, checkfirst=True)
    HrWorkplaceFeedLike.__table__.create(bind=bind, checkfirst=True)
    HrWorkplaceFeedComment.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    HrWorkplaceFeedComment.__table__.drop(bind=bind, checkfirst=True)
    HrWorkplaceFeedLike.__table__.drop(bind=bind, checkfirst=True)
    HrWorkplaceFeedPost.__table__.drop(bind=bind, checkfirst=True)
