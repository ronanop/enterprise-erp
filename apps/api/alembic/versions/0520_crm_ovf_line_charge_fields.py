"""Persist OVF charge-row description, distributor, and contact fields."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0520_crm_ovf_line_charge_fields"
down_revision: str | None = "0519_mkt_operations_platform"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf_line",
        sa.Column("description", sa.Text(), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_ovf_line",
        sa.Column("distributor_name", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_ovf_line",
        sa.Column("contact_person", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_ovf_line",
        sa.Column("contact_number", sa.String(length=100), nullable=True),
        schema="crm",
    )

    # Backfill description from matching quote lines; repair vendor rows where
    # distributor was previously stored in product_name.
    op.execute(
        sa.text(
            """
            UPDATE crm.crm_ovf_line AS ol
            SET description = ql.description
            FROM crm.crm_ovf AS o, crm.crm_quote_line AS ql
            WHERE ol.ovf_id = o.id
              AND ql.quote_id = o.quote_id
              AND ql.line_no = ol.line_no
              AND ql.is_deleted = false
              AND o.is_deleted = false
              AND ol.is_deleted = false
              AND ol.description IS NULL
              AND ql.description IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE crm.crm_ovf_line AS ol
            SET distributor_name = ol.product_name,
                product_name = ql.product_name,
                description = COALESCE(ol.description, ql.description)
            FROM crm.crm_ovf AS o, crm.crm_quote_line AS ql
            WHERE ol.ovf_id = o.id
              AND ql.quote_id = o.quote_id
              AND ql.line_no = ol.line_no
              AND ql.is_deleted = false
              AND o.is_deleted = false
              AND ol.is_deleted = false
              AND ol.side = 'vendor'
              AND ol.distributor_name IS NULL
              AND lower(btrim(ol.product_name)) <> lower(btrim(ql.product_name))
            """
        )
    )


def downgrade() -> None:
    op.drop_column("crm_ovf_line", "contact_number", schema="crm")
    op.drop_column("crm_ovf_line", "contact_person", schema="crm")
    op.drop_column("crm_ovf_line", "distributor_name", schema="crm")
    op.drop_column("crm_ovf_line", "description", schema="crm")
