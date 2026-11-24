"""Create AstAssetAudit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0259_ast_asset_audit"
down_revision: str | None = "0258_ast_asset_revaluation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_audit import AstAssetAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetAudit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_audit import AstAssetAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetAudit.__table__.drop(bind=op.get_bind(), checkfirst=True)
