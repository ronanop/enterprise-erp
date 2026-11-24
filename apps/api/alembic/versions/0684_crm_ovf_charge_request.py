"""Queue SCM freight and finance changes until an approver accepts them."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0684_crm_ovf_charge_request"
down_revision: str | Sequence[str] | None = "0683_proc_order_line_description"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_ovf",
        sa.Column("scm_charge_request_status", sa.String(length=20), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_charge_request_freight", sa.Numeric(18, 4), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_charge_request_finance_pct", sa.Numeric(6, 3), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_charge_requested_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_charge_requested_by", sa.Uuid(), nullable=True),
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_ovf_charge_request_status",
        "crm_ovf",
        "scm_charge_request_status IS NULL OR scm_charge_request_status IN "
        "('pending','accepted','rejected')",
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_crm_ovf_charge_request_status",
        "crm_ovf",
        schema="crm",
        type_="check",
    )
    op.drop_column("crm_ovf", "scm_charge_requested_by", schema="crm")
    op.drop_column("crm_ovf", "scm_charge_requested_at", schema="crm")
    op.drop_column("crm_ovf", "scm_charge_request_finance_pct", schema="crm")
    op.drop_column("crm_ovf", "scm_charge_request_freight", schema="crm")
    op.drop_column("crm_ovf", "scm_charge_request_status", schema="crm")
