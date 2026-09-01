"""Sync org-assigned HR/Assets module admins to RBAC roles."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0583_sync_org_module_admin_roles"
down_revision: str | None = "0582_reset_platform_admin_access"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.orm import Session

    from modules.foundation.models.security import SecTenant
    from modules.foundation.service.org_module_admin_sync_service import OrgModuleAdminSyncService

    session = Session(bind=bind)
    try:
        tenants = session.scalars(sa.select(SecTenant)).all()
        sync = OrgModuleAdminSyncService(session)
        for tenant in tenants:
            sync.sync_all_org_module_admins(tenant.id)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    pass
