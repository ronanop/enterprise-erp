"""Create MfgMaterialReturn table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0106_mfg_material_return"
down_revision: str | None = "0105_mfg_material_issue_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.material_return import MfgMaterialReturn  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialReturn.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.material_return import MfgMaterialReturn  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMaterialReturn.__table__.drop(bind=op.get_bind(), checkfirst=True)
