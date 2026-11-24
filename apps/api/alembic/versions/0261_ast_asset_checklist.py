"""Create AstAssetChecklist table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0261_ast_asset_checklist"
down_revision: str | None = "0260_ast_asset_document"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_checklist import AstAssetChecklist  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetChecklist.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_checklist import AstAssetChecklist  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetChecklist.__table__.drop(bind=op.get_bind(), checkfirst=True)
