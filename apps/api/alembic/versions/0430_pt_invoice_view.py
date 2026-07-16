"""Create PtInvoiceView table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.invoice_view import PtInvoiceView  # noqa: F401

revision: str = "0430_pt_invoice_view"
down_revision: str | None = "0429_pt_order_view"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PtInvoiceView.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PtInvoiceView.__table__.drop(bind=op.get_bind(), checkfirst=True)
