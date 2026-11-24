"""Create AstAssetDocument table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0260_ast_asset_document"
down_revision: str | None = "0259_ast_asset_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_document import AstAssetDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_document import AstAssetDocument  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
