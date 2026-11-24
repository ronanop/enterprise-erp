"""Create AstAssetRevaluation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0258_ast_asset_revaluation"
down_revision: str | None = "0257_ast_asset_disposal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_revaluation import AstAssetRevaluation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetRevaluation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_revaluation import AstAssetRevaluation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetRevaluation.__table__.drop(bind=op.get_bind(), checkfirst=True)
