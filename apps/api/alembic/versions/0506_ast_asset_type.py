"""IT Asset Type master table + nullable FK on ast_asset + seed 7 types."""

from collections.abc import Sequence

from alembic import op

revision: str = "0506_ast_asset_type"
down_revision: str | None = "0505_ast_location_master"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_type import AstAssetType  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstAssetType.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_type import AstAssetType  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstAssetType.__table__.drop(bind=op.get_bind(), checkfirst=True)
