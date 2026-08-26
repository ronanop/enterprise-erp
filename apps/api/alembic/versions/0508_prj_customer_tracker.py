"""Add versioned customer tracker files."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import create_index_if_missing, table_exists  # noqa: E402

revision: str = "0508_prj_customer_tracker"
down_revision: str | Sequence[str] | None = "0507_prj_split_onsite_stages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "prj_customer_tracker", schema="project"):
        op.create_table(
            "prj_customer_tracker",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("tenant_id", sa.UUID(), nullable=False),
            sa.Column("company_id", sa.UUID(), nullable=False),
            sa.Column("branch_id", sa.UUID(), nullable=False),
            sa.Column("project_id", sa.UUID(), nullable=False),
            sa.Column("version_no", sa.Integer(), nullable=False),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("storage_uri", sa.String(500), nullable=False),
            sa.Column("content_type", sa.String(255), nullable=True),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("content_hash", sa.String(128), nullable=False),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("created_by", sa.UUID(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_by", sa.UUID(), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["project_id"], ["project.prj_project.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_id", "version_no", name="uq_prj_customer_tracker_version"),
            schema="project",
        )
    create_index_if_missing(
        "ix_prj_customer_tracker_project_id",
        "prj_customer_tracker",
        ["project_id"],
        schema="project",
    )
    create_index_if_missing(
        "ix_prj_customer_tracker_branch_id",
        "prj_customer_tracker",
        ["branch_id"],
        schema="project",
    )


def downgrade() -> None:
    op.drop_index("ix_prj_customer_tracker_branch_id", table_name="prj_customer_tracker", schema="project")
    op.drop_index("ix_prj_customer_tracker_project_id", table_name="prj_customer_tracker", schema="project")
    op.drop_table("prj_customer_tracker", schema="project")
