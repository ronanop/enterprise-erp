"""Create AstAssetAssignment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0249_ast_asset_assignment"
down_revision: str | None = "0248_ast_asset_component"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_assignment import AstAssetAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_assignment import AstAssetAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
