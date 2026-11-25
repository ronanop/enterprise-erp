"""ESS Instagram-style social feed tables (posts, media, likes, comments)."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0688_hr_ess_feed"
down_revision: str | None = "0687_merge_ess_scm_alembic_heads"
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
        "hr_ess_feed_post",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column(
            "author_employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("aspect_ratio", sa.String(10), nullable=False, server_default="1:1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        *_audit_cols(),
        sa.CheckConstraint(
            "status IN ('draft','processing','published','failed','hidden')",
            name="ck_hr_ess_feed_post_status",
        ),
        sa.CheckConstraint(
            "aspect_ratio IN ('1:1','3:4','4:3')",
            name="ck_hr_ess_feed_post_aspect",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_ess_feed_post_tenant_id", "hr_ess_feed_post", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_post_company_id", "hr_ess_feed_post", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_post_branch_id", "hr_ess_feed_post", ["branch_id"], schema="hr")
    op.create_index(
        "ix_hr_ess_feed_post_author_employee_id",
        "hr_ess_feed_post",
        ["author_employee_id"],
        schema="hr",
    )
    op.create_index("ix_hr_ess_feed_post_status", "hr_ess_feed_post", ["status"], schema="hr")

    op.create_table(
        "hr_ess_feed_media",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column(
            "post_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("media_type", sa.String(20), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("storage_uri", sa.String(500), nullable=False),
        sa.Column("processed_storage_uri", sa.String(500), nullable=True),
        sa.Column("byte_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("processing_status", sa.String(20), nullable=False, server_default="ready"),
        *_audit_cols(),
        sa.CheckConstraint("media_type IN ('image','video')", name="ck_hr_ess_feed_media_type"),
        sa.CheckConstraint(
            "processing_status IN ('ready','pending','processing','failed')",
            name="ck_hr_ess_feed_media_proc",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_ess_feed_media_tenant_id", "hr_ess_feed_media", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_media_company_id", "hr_ess_feed_media", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_media_branch_id", "hr_ess_feed_media", ["branch_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_media_post_id", "hr_ess_feed_media", ["post_id"], schema="hr")

    op.create_table(
        "hr_ess_feed_like",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column(
            "post_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        *_audit_cols(),
        sa.UniqueConstraint("post_id", "employee_id", name="uk_hr_ess_feed_like_post_emp"),
        schema="hr",
    )
    op.create_index("ix_hr_ess_feed_like_tenant_id", "hr_ess_feed_like", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_like_company_id", "hr_ess_feed_like", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_like_branch_id", "hr_ess_feed_like", ["branch_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_like_post_id", "hr_ess_feed_like", ["post_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_like_employee_id", "hr_ess_feed_like", ["employee_id"], schema="hr")

    op.create_table(
        "hr_ess_feed_comment",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column(
            "post_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_feed_post.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "author_employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_edited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_ess_feed_comment_tenant_id", "hr_ess_feed_comment", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_comment_company_id", "hr_ess_feed_comment", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_comment_branch_id", "hr_ess_feed_comment", ["branch_id"], schema="hr")
    op.create_index("ix_hr_ess_feed_comment_post_id", "hr_ess_feed_comment", ["post_id"], schema="hr")
    op.create_index(
        "ix_hr_ess_feed_comment_author_employee_id",
        "hr_ess_feed_comment",
        ["author_employee_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_table("hr_ess_feed_comment", schema="hr")
    op.drop_table("hr_ess_feed_like", schema="hr")
    op.drop_table("hr_ess_feed_media", schema="hr")
    op.drop_table("hr_ess_feed_post", schema="hr")
