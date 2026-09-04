"""Add designation to crm_lead."""

from alembic import op
import sqlalchemy as sa

revision = "0493_crm_lead_designation"
down_revision = "0492_org_branch_head"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_lead",
        sa.Column("designation", sa.String(length=100), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("crm_lead", "designation", schema="crm")
