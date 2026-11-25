"""ESS Instagram-style Stories tables (24h ephemeral media + views)."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0689_hr_ess_stories"
down_revision: str | None = "0688_hr_ess_feed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)


def _audit_cols() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", UUID, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", UUID, nullable=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("foundation.sec_tenant.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("company_id", UUID, sa.ForeignKey("organization.org_company.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("branch_id", UUID, sa.ForeignKey("organization.org_branch.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", UUID, nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "hr_ess_story",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "author_employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("media_type", sa.String(20), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("storage_uri", sa.String(500), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("byte_size", sa.Integer(), server_default="0", nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("media_type IN ('image','video')", name="ck_hr_ess_story_media_type"),
        sa.CheckConstraint(
            "status IN ('active','expired','hidden')",
            name="ck_hr_ess_story_status",
        ),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_ess_story_tenant_id", "hr_ess_story", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_story_company_id", "hr_ess_story", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_story_branch_id", "hr_ess_story", ["branch_id"], schema="hr")
    op.create_index(
        "ix_hr_ess_story_author_employee_id",
        "hr_ess_story",
        ["author_employee_id"],
        schema="hr",
    )
    op.create_index("ix_hr_ess_story_status", "hr_ess_story", ["status"], schema="hr")
    op.create_index("ix_hr_ess_story_expires_at", "hr_ess_story", ["expires_at"], schema="hr")

    op.create_table(
        "hr_ess_story_view",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "story_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "viewer_employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "story_id",
            "viewer_employee_id",
            name="uk_hr_ess_story_view_story_viewer",
        ),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_ess_story_view_tenant_id", "hr_ess_story_view", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_story_view_company_id", "hr_ess_story_view", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_story_view_branch_id", "hr_ess_story_view", ["branch_id"], schema="hr")
    op.create_index("ix_hr_ess_story_view_story_id", "hr_ess_story_view", ["story_id"], schema="hr")
    op.create_index(
        "ix_hr_ess_story_view_viewer_employee_id",
        "hr_ess_story_view",
        ["viewer_employee_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_table("hr_ess_story_view", schema="hr")
    op.drop_table("hr_ess_story", schema="hr")
