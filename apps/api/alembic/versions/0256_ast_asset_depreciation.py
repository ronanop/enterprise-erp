"""Create AstAssetDepreciation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0256_ast_asset_depreciation"
down_revision: str | None = "0255_ast_service_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_depreciation import AstAssetDepreciation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDepreciation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_depreciation import AstAssetDepreciation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDepreciation.__table__.drop(bind=op.get_bind(), checkfirst=True)
