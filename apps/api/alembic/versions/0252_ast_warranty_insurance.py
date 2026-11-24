"""Create asset policy tables."""

from collections.abc import Sequence

from alembic import op

revision: str = "0252_ast_warranty_insurance"
down_revision: str | None = "0251_ast_asset_location"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_warranty import AstAssetWarranty  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetWarranty.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_warranty import AstAssetWarranty  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetWarranty.__table__.drop(bind=op.get_bind(), checkfirst=True)
