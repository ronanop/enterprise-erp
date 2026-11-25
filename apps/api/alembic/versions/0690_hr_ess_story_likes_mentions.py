"""ESS Stories — likes, text overlays, mentions."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0690_hr_ess_story_likes_mentions"
down_revision: str | None = "0689_hr_ess_stories"
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
    op.add_column(
        "hr_ess_story",
        sa.Column("like_count", sa.Integer(), server_default="0", nullable=False),
        schema="hr",
    )
    op.add_column(
        "hr_ess_story",
        sa.Column("overlays_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="hr",
    )

    op.create_table(
        "hr_ess_story_like",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "story_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint("story_id", "employee_id", name="uk_hr_ess_story_like_story_emp"),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_ess_story_like_tenant_id", "hr_ess_story_like", ["tenant_id"], schema="hr")
    op.create_index("ix_hr_ess_story_like_company_id", "hr_ess_story_like", ["company_id"], schema="hr")
    op.create_index("ix_hr_ess_story_like_story_id", "hr_ess_story_like", ["story_id"], schema="hr")
    op.create_index("ix_hr_ess_story_like_employee_id", "hr_ess_story_like", ["employee_id"], schema="hr")

    op.create_table(
        "hr_ess_story_mention",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "story_id",
            UUID,
            sa.ForeignKey("hr.hr_ess_story.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "mentioned_employee_id",
            UUID,
            sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.UniqueConstraint(
            "story_id",
            "mentioned_employee_id",
            name="uk_hr_ess_story_mention_story_emp",
        ),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index(
        "ix_hr_ess_story_mention_tenant_id", "hr_ess_story_mention", ["tenant_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_ess_story_mention_company_id", "hr_ess_story_mention", ["company_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_ess_story_mention_story_id", "hr_ess_story_mention", ["story_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_ess_story_mention_mentioned_employee_id",
        "hr_ess_story_mention",
        ["mentioned_employee_id"],
        schema="hr",
    )


def downgrade() -> None:
    op.drop_table("hr_ess_story_mention", schema="hr")
    op.drop_table("hr_ess_story_like", schema="hr")
    op.drop_column("hr_ess_story", "overlays_json", schema="hr")
    op.drop_column("hr_ess_story", "like_count", schema="hr")
