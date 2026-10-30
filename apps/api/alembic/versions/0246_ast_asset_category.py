"""Create AstAssetCategory table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0246_ast_asset_category"
down_revision: str | None = "0245_create_asset_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_category import AstAssetCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetCategory.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_category import AstAssetCategory  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetCategory.__table__.drop(bind=op.get_bind(), checkfirst=True)
