"""Create MfgMaterialIssueLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0105_mfg_material_issue_line"
down_revision: str | None = "0104_mfg_material_issue"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.material_issue import MfgMaterialIssueLine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialIssueLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.material_issue import MfgMaterialIssueLine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialIssueLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
