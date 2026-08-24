"""Create hr.hr_digital_onboarding for persisted candidate portal invitations."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0478_hr_digital_onboarding"
down_revision: str | None = "0477_hr_sep_it_accounts_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_digital_onboarding",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_code", sa.String(40), nullable=False),
        sa.Column("invitation_token", sa.String(64), nullable=False),
        sa.Column("invitation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("candidate_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("candidate_email", sa.String(200), nullable=False, server_default=""),
        sa.Column("case_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terms_version", sa.String(40), nullable=True),
        sa.Column("terms_accepted_ip", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["foundation.sec_tenant.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("invitation_token", name="uk_hr_dig_onb_token"),
        sa.UniqueConstraint("tenant_id", "case_code", name="uk_hr_dig_onb_tenant_code"),
        schema="hr",
    )
    op.create_index("ix_hr_dig_onb_tenant", "hr_digital_onboarding", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_dig_onb_token", "hr_digital_onboarding", ["invitation_token"], schema="hr")
    op.create_index("ix_hr_dig_onb_status", "hr_digital_onboarding", ["status"], schema="hr")
    op.create_index("ix_hr_dig_onb_case_code", "hr_digital_onboarding", ["case_code"], schema="hr")


def downgrade() -> None:
    op.drop_index("ix_hr_dig_onb_case_code", table_name="hr_digital_onboarding", schema="hr")
    op.drop_index("ix_hr_dig_onb_status", table_name="hr_digital_onboarding", schema="hr")
    op.drop_index("ix_hr_dig_onb_token", table_name="hr_digital_onboarding", schema="hr")
    op.drop_index("ix_hr_dig_onb_tenant", table_name="hr_digital_onboarding", schema="hr")
    op.drop_table("hr_digital_onboarding", schema="hr")
