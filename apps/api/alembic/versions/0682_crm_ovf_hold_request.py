"""Queue SCM OVF hold until a procurement admin accepts it."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0682_crm_ovf_hold_request"
down_revision: str | Sequence[str] | None = "0681_svc_sla_pause_duration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_ovf",
        sa.Column("scm_hold_request_status", sa.String(length=20), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_hold_request_remark", sa.Text(), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_hold_requested_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_hold_requested_by", sa.Uuid(), nullable=True),
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_ovf_hold_request_status",
        "crm_ovf",
        "scm_hold_request_status IS NULL OR scm_hold_request_status IN "
        "('pending','accepted','rejected')",
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_ovf_hold_request_status", "crm_ovf", schema="crm")
    op.drop_column("crm_ovf", "scm_hold_requested_by", schema="crm")
    op.drop_column("crm_ovf", "scm_hold_requested_at", schema="crm")
    op.drop_column("crm_ovf", "scm_hold_request_remark", schema="crm")
    op.drop_column("crm_ovf", "scm_hold_request_status", schema="crm")
