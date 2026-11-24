"""IT Location → Building master tables + FKs on ast_asset_location + backfill."""

from collections.abc import Sequence

from alembic import op

revision: str = "0505_ast_location_master"
down_revision: str | None = "0504_ast_nonit_type_details"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.site_building import AstBuilding  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstBuilding.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.site_building import AstBuilding  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstBuilding.__table__.drop(bind=op.get_bind(), checkfirst=True)
