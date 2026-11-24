"""Opportunity service sourcing channel + procurement order_kind for service POs."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0666_crm_service_sourcing_scm_order_kind"
down_revision: str | Sequence[str] | None = "0665_merge_hrms_alembic_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_opportunity",
        sa.Column("service_sourcing_channel", sa.String(length=40), nullable=True),
        schema="crm",
    )
    op.add_column(
        "proc_order_header",
        sa.Column(
            "order_kind",
            sa.String(length=32),
            nullable=False,
            server_default="product",
        ),
        schema="procurement",
    )
    op.create_check_constraint(
        "ck_proc_oh_order_kind",
        "proc_order_header",
        "order_kind IN ('product', 'vendor_service', 'internal_service')",
        schema="procurement",
    )
    # Backfill from linked lead.deal_type JSON when Services were selected.
    op.execute(
        """
        UPDATE crm.crm_opportunity AS o
        SET service_sourcing_channel = CASE
            WHEN (l.deal_type::jsonb ->> 'service') IN ('Outsourced', 'Cache Service')
            THEN l.deal_type::jsonb ->> 'service'
            ELSE NULL
        END
        FROM crm.crm_lead AS l
        WHERE o.lead_id = l.id
          AND o.is_deleted IS FALSE
          AND l.is_deleted IS FALSE
          AND o.has_services IS TRUE
          AND l.deal_type IS NOT NULL
          AND l.deal_type LIKE '{%'
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_proc_oh_order_kind",
        "proc_order_header",
        schema="procurement",
        type_="check",
    )
    op.drop_column("proc_order_header", "order_kind", schema="procurement")
    op.drop_column("crm_opportunity", "service_sourcing_channel", schema="crm")
