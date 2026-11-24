"""Create ast_dc_challan_document for stored DC challan files."""

from collections.abc import Sequence

from alembic import op

revision: str = "0498_ast_dc_challan_document"
down_revision: str | None = "0497_ast_dc_challan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.dc_challan_document import AstDcChallanDocument  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDcChallanDocument.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.dc_challan_document import AstDcChallanDocument  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDcChallanDocument.__table__.drop(bind=op.get_bind(), checkfirst=True)
