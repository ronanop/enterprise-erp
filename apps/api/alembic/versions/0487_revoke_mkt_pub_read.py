"""Revoke publication:read from media, banner, and campaign demo roles."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0487_revoke_mkt_pub_read"
down_revision: str | None = "0486_mkt_publication_read_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEMO_ROLES = (
    "MARKETING_MEDIA_HANDLER",
    "MARKETING_BANNER_HANDLER",
    "MARKETING_CAMPAIGN_HANDLER",
)


def upgrade() -> None:
    conn = op.get_bind()
    perm = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = 'marketing.publication:read'")
    ).first()
    if not perm:
        return
    perm_id = str(perm[0])
    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in DEMO_ROLES:
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
            if not role:
                continue
            conn.execute(
                sa.text(
                    """
                    DELETE FROM foundation.sec_role_permission
                    WHERE role_id = :rid AND permission_id = :pid
                    """
                ),
                {"rid": str(role[0]), "pid": perm_id},
            )


def downgrade() -> None:
    pass
