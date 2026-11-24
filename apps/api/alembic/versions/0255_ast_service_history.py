"""Create AstAssetServiceHistory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0255_ast_service_history"
down_revision: str | None = "0254_ast_asset_maintenance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_service_history import AstAssetServiceHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetServiceHistory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_service_history import AstAssetServiceHistory  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetServiceHistory.__table__.drop(bind=op.get_bind(), checkfirst=True)
