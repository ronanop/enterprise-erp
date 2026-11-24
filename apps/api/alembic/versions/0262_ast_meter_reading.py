"""Create AstAssetMeterReading table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0262_ast_meter_reading"
down_revision: str | None = "0261_ast_asset_checklist"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_meter_reading import AstAssetMeterReading  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetMeterReading.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_meter_reading import AstAssetMeterReading  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetMeterReading.__table__.drop(bind=op.get_bind(), checkfirst=True)
