"""Create marketing tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.models import (  # noqa: F401
    MktActivityLog,
    MktCampaign,
    MktCampaignAudience,
    MktChannel,
    MktContentApproval,
    MktContentAssignment,
    MktContentAssetLink,
    MktContentItem,
    MktMediaAsset,
    MktPublication,
)

TABLES = [
    MktCampaign.__table__,
    MktCampaignAudience.__table__,
    MktChannel.__table__,
    MktContentItem.__table__,
    MktContentAssignment.__table__,
    MktContentApproval.__table__,
    MktPublication.__table__,
    MktMediaAsset.__table__,
    MktContentAssetLink.__table__,
    MktActivityLog.__table__,
]

revision: str = "0479_mkt_tables"
down_revision: str | None = "0478_create_marketing_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    for table in TABLES:
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(TABLES):
        table.drop(bind=bind, checkfirst=True)
