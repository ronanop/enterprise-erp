"""Create MfgMaterialIssue table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0104_mfg_material_issue"
down_revision: str | None = "0103_mfg_production_operation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.material_issue import MfgMaterialIssue  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialIssue.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.material_issue import MfgMaterialIssue  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialIssue.__table__.drop(bind=op.get_bind(), checkfirst=True)
