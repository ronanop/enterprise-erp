"""Create MfgBom table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0098_mfg_bom"
down_revision: str | None = "0097_mfg_machine"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.bom import MfgBom  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgBom.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.bom import MfgBom  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgBom.__table__.drop(bind=op.get_bind(), checkfirst=True)
