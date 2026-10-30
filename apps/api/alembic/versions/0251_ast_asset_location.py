"""Create AstAssetLocation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0251_ast_asset_location"
down_revision: str | None = "0250_ast_asset_transfer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_location import AstAssetLocation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetLocation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_location import AstAssetLocation  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetLocation.__table__.drop(bind=op.get_bind(), checkfirst=True)
