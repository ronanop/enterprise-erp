"""Create AstAssetComponent table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0248_ast_asset_component"
down_revision: str | None = "0247_ast_asset"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_component import AstAssetComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetComponent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_component import AstAssetComponent  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetComponent.__table__.drop(bind=op.get_bind(), checkfirst=True)
