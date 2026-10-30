"""Create AstAssetMaintenancePlan table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0253_ast_maint_plan"
down_revision: str | None = "0252_ast_warranty_insurance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetMaintenancePlan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan  # noqa: F401
    except ModuleNotFoundError:
        return
    AstAssetMaintenancePlan.__table__.drop(bind=op.get_bind(), checkfirst=True)
