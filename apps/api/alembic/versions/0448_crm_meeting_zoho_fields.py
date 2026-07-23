"""Add Zoho-style Meeting Information fields to crm_meeting."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0448_crm_meeting_zoho"
down_revision: str | None = "0447_crm_ovf_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("crm_meeting", sa.Column("end_date", sa.Date(), nullable=True), schema="crm")
    op.add_column(
        "crm_meeting",
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("related_to", sa.String(length=30), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("repeat_rule", sa.String(length=30), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("participants_reminder", sa.String(length=50), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("reminder_primary", sa.String(length=50), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("reminder_secondary", sa.String(length=50), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_meeting",
        sa.Column("company_account_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    op.create_foreign_key(
        "fk_crm_meeting_company_account",
        "crm_meeting",
        "crm_company",
        ["company_account_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_crm_meeting_company_account_id",
        "crm_meeting",
        ["company_account_id"],
        unique=False,
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_meeting_company_account_id", table_name="crm_meeting", schema="crm")
    op.drop_constraint(
        "fk_crm_meeting_company_account",
        "crm_meeting",
        schema="crm",
        type_="foreignkey",
    )
    for column_name in (
        "company_account_id",
        "reminder_secondary",
        "reminder_primary",
        "participants_reminder",
        "repeat_rule",
        "related_to",
        "all_day",
        "end_date",
    ):
        op.drop_column("crm_meeting", column_name, schema="crm")
