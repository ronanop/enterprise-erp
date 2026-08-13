"""User ERP module assignments."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0496_sec_user_module"
down_revision: str | None = "0495_crm_kyc_record"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sec_user_module",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("foundation.sec_tenant.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("foundation.sec_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("module_key", sa.String(50), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint("user_id", "module_key", name="uk_sec_user_module"),
        schema="foundation",
    )
    op.create_index(
        "ix_foundation_sec_user_module_tenant_id",
        "sec_user_module",
        ["tenant_id"],
        schema="foundation",
    )
    op.create_index(
        "ix_foundation_sec_user_module_user_id",
        "sec_user_module",
        ["user_id"],
        schema="foundation",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_foundation_sec_user_module_user_id",
        table_name="sec_user_module",
        schema="foundation",
    )
    op.drop_index(
        "ix_foundation_sec_user_module_tenant_id",
        table_name="sec_user_module",
        schema="foundation",
    )
    op.drop_table("sec_user_module", schema="foundation")
