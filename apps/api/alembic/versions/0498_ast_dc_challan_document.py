"""Create ast_dc_challan_document for stored DC challan files."""

from collections.abc import Sequence
from pathlib import Path
import sys

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.dc_challan_document import AstDcChallanDocument  # noqa: E402, F401

revision: str = "0498_ast_dc_challan_document"
down_revision: str | None = "0497_ast_dc_challan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    AstDcChallanDocument.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    AstDcChallanDocument.__table__.drop(bind=bind, checkfirst=True)
