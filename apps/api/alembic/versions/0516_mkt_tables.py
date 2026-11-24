"""Create marketing module tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0516_mkt_tables"
down_revision: str | Sequence[str] | None = "0515_create_marketing_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.marketing.models.brand_voice import MktBrandVoice
    except ModuleNotFoundError:
        return
    MktBrandVoice.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.marketing.models.brand_voice import MktBrandVoice
    except ModuleNotFoundError:
        return
    MktBrandVoice.__table__.drop(bind=op.get_bind(), checkfirst=True)
