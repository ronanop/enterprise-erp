"""Allow ovf_pdf and po_pdf categories on CRM attachments (approval print PDFs)."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

revision: str = "0654_crm_attachment_ovf_po_pdf_category"
down_revision: str | None = "0653_crm_quote_revision_payload"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW = (
    "category IN ("
    "'boq','sow','oem_quote','customer_po','vendor_quote','vendor_invoice',"
    "'contract','other','ovf_pdf','po_pdf'"
    ")"
)
_OLD = (
    "category IN ("
    "'boq','sow','oem_quote','customer_po','vendor_quote','vendor_invoice',"
    "'contract','other'"
    ")"
)


def upgrade() -> None:
    op.drop_constraint("ck_crm_attachment_category", "crm_attachment", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_attachment_category",
        "crm_attachment",
        _NEW,
        schema="crm",
    )


def downgrade() -> None:
    op.execute(
        "UPDATE crm.crm_attachment SET category = 'other' "
        "WHERE category IN ('ovf_pdf', 'po_pdf')"
    )
    op.drop_constraint("ck_crm_attachment_category", "crm_attachment", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_attachment_category",
        "crm_attachment",
        _OLD,
        schema="crm",
    )
