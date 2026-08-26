"""Add designation to crm_lead."""

from alembic import op
import sqlalchemy as sa

revision = "0493_crm_lead_designation"
down_revision = "0492_org_branch_head"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table may already have this column when crm_lead was created from the ORM model.
    op.execute(
        sa.text(
            """
            ALTER TABLE crm.crm_lead
            ADD COLUMN IF NOT EXISTS designation VARCHAR(100)
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE crm.crm_lead DROP COLUMN IF EXISTS designation"))
