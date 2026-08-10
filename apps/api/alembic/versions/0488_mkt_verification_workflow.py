"""Add multi-verifier workflow tables and content design fields."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

revision: str = "0488_mkt_verification_workflow"
down_revision: str | None = "0487_revoke_mkt_pub_read"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_PERM = ("marketing.content:verify", "marketing.content", "verify", "marketing")


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_permission
            (id, permission_code, resource, action, module, is_active, created_at)
            VALUES (:id, :code, :resource, :action, :module, true, :now)
            """
        ),
        {"id": perm_id, "code": code, "resource": resource, "action": action, "module": module, "now": now},
    )
    return perm_id


def _grant(conn, now, tenant_id, role_id, perm_id):
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM foundation.sec_role_permission WHERE role_id = :rid AND permission_id = :pid"
        ),
        {"rid": role_id, "pid": perm_id},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role_permission
            (id, tenant_id, role_id, permission_id, granted_at)
            VALUES (:id, :tid, :rid, :pid, :now)
            """
        ),
        {"id": str(uuid4()), "tid": tenant_id, "rid": role_id, "pid": perm_id, "now": now},
    )


def upgrade() -> None:
    op.add_column("mkt_content_item", sa.Column("theme", sa.String(255), nullable=True), schema="marketing")
    op.add_column("mkt_content_item", sa.Column("font_name", sa.String(120), nullable=True), schema="marketing")
    op.add_column("mkt_content_item", sa.Column("font_size", sa.String(60), nullable=True), schema="marketing")
    op.add_column("mkt_content_item", sa.Column("color_codes", sa.String(500), nullable=True), schema="marketing")
    op.add_column("mkt_content_item", sa.Column("workflow_stage", sa.String(40), nullable=True), schema="marketing")
    op.add_column(
        "mkt_content_item",
        sa.Column("final_head_approved_at", sa.DateTime(timezone=True), nullable=True),
        schema="marketing",
    )
    op.add_column("mkt_media_asset", sa.Column("asset_kind", sa.String(20), nullable=True), schema="marketing")
    op.add_column("mkt_media_asset", sa.Column("width_px", sa.Integer(), nullable=True), schema="marketing")
    op.add_column("mkt_media_asset", sa.Column("height_px", sa.Integer(), nullable=True), schema="marketing")
    op.add_column(
        "mkt_content_asset_link",
        sa.Column("asset_role", sa.String(30), nullable=True),
        schema="marketing",
    )

    op.create_table(
        "mkt_content_verification",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("content_item_id", sa.UUID(), nullable=False),
        sa.Column("verifier_role", sa.String(40), nullable=False),
        sa.Column("verifier_user_id", sa.UUID(), nullable=True),
        sa.Column("overall_status", sa.String(30), nullable=False),
        sa.Column("overall_comments", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["content_item_id"], ["marketing.mkt_content_item.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("content_item_id", "verifier_role", name="uq_mkt_content_verification_role"),
        schema="marketing",
    )
    op.create_table(
        "mkt_verification_item",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("verification_id", sa.UUID(), nullable=False),
        sa.Column("item_key", sa.String(60), nullable=False),
        sa.Column("item_label", sa.String(120), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(["verification_id"], ["marketing.mkt_content_verification.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("verification_id", "item_key", name="uq_mkt_verification_item_key"),
        schema="marketing",
    )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    code, resource, action, module = NEW_PERM
    perm_id = _ensure_permission(conn, now, code, resource, action, module)

    grant_roles = (
        "MARKETING_ADMIN",
        "MARKETING_MANAGER",
        "MARKETING_HEAD_DEMO",
        "MARKETING_CAMPAIGN_HANDLER",
        "MARKETING_LINKEDIN_HANDLER",
        "MARKETING_VIDEO_EDITOR",
        "MARKETING_PUBLISHER_DEMO",
        "SUPER_ADMIN",
        "TENANT_ADMIN",
    )
    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in grant_roles:
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                    LIMIT 1
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role:
                _grant(conn, now, tid, str(role[0]), perm_id)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM foundation.sec_role_permission WHERE permission_id IN "
            "(SELECT id FROM foundation.sec_permission WHERE permission_code = 'marketing.content:verify')"
        )
    )
    conn.execute(
        sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = 'marketing.content:verify'")
    )
    op.drop_table("mkt_verification_item", schema="marketing")
    op.drop_table("mkt_content_verification", schema="marketing")
    op.drop_column("mkt_content_asset_link", "asset_role", schema="marketing")
    op.drop_column("mkt_media_asset", "height_px", schema="marketing")
    op.drop_column("mkt_media_asset", "width_px", schema="marketing")
    op.drop_column("mkt_media_asset", "asset_kind", schema="marketing")
    op.drop_column("mkt_content_item", "final_head_approved_at", schema="marketing")
    op.drop_column("mkt_content_item", "workflow_stage", schema="marketing")
    op.drop_column("mkt_content_item", "color_codes", schema="marketing")
    op.drop_column("mkt_content_item", "font_size", schema="marketing")
    op.drop_column("mkt_content_item", "font_name", schema="marketing")
    op.drop_column("mkt_content_item", "theme", schema="marketing")
