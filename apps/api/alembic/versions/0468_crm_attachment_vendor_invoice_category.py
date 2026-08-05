"""Allow vendor_invoice category on CRM attachments (GRN vendor invoice PDFs)."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

revision: str = "0468_crm_attachment_vendor_invoice_category"
down_revision: str | None = "0467_proc_receipt_batch_vendor_invoice"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CATEGORY_CHECK = (
    "category IN ('boq','sow','oem_quote','customer_po','vendor_quote','vendor_invoice','other')"
)


def upgrade() -> None:
    op.drop_constraint("ck_crm_attachment_category", "crm_attachment", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_attachment_category",
        "crm_attachment",
        _CATEGORY_CHECK,
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_attachment_category", "crm_attachment", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_attachment_category",
        "crm_attachment",
        "category IN ('boq','sow','oem_quote','customer_po','vendor_quote','other')",
        schema="crm",
    )
