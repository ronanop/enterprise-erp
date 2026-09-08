"""Social reply inbox for owned posts."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0590_mkt_social_inbox"
down_revision: str | Sequence[str] | None = "0601_sync_service_module_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mkt_social_inbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("publish_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("social_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("platform_code", sa.String(50), nullable=False),
        sa.Column("external_thread_id", sa.String(255), nullable=False),
        sa.Column("author_name", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("assignee_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("kind IN ('comment','mention')", name="ck_mkt_social_inbox_kind"),
        sa.CheckConstraint("status IN ('open','assigned','done')", name="ck_mkt_social_inbox_status"),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["campaign_id"], ["marketing.mkt_campaign.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["content_id"], ["marketing.mkt_generated_content.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["publish_job_id"], ["marketing.mkt_publish_job.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["social_account_id"], ["marketing.mkt_social_account.id"], ondelete="SET NULL"),
        schema="marketing",
    )
    op.create_index("ix_mkt_social_inbox_campaign", "mkt_social_inbox", ["campaign_id"], schema="marketing")
    op.create_index("ix_mkt_social_inbox_status", "mkt_social_inbox", ["status"], schema="marketing")


def downgrade() -> None:
    op.drop_table("mkt_social_inbox", schema="marketing")
