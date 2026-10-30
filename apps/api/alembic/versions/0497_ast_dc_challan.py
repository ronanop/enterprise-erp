"""Create ast_dc_challan + DC challan permissions."""

from collections.abc import Sequence

from alembic import op

revision: str = "0497_ast_dc_challan"
down_revision: str | None = "0496_revert_org_location_head_office"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.dc_challan import AstDcChallan  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDcChallan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.dc_challan import AstDcChallan  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDcChallan.__table__.drop(bind=op.get_bind(), checkfirst=True)
