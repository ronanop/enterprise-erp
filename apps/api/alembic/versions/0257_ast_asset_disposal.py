"""Create AstAssetDisposal table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0257_ast_asset_disposal"
down_revision: str | None = "0256_ast_asset_depreciation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_disposal import AstAssetDisposal  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDisposal.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_disposal import AstAssetDisposal  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDisposal.__table__.drop(bind=op.get_bind(), checkfirst=True)
