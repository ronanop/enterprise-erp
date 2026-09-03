"""Sync org-assigned Service module admins/members to SERVICE_* RBAC roles."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0601_sync_service_module_roles"
down_revision: str | None = "0600_svc_asset_confirmed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.orm import Session

    from modules.foundation.domain.erp_modules import MODULE_ROLE_ADMIN, MODULE_ROLE_MEMBER
    from modules.foundation.domain.value_objects import TenantContext
    from modules.foundation.models.security import SecTenant, SecUser, SecUserModule
    from modules.foundation.service.org_module_admin_sync_service import OrgModuleAdminSyncService

    session = Session(bind=bind)
    try:
        sync = OrgModuleAdminSyncService(session)
        tenants = session.scalars(sa.select(SecTenant)).all()
        for tenant in tenants:
            sync.sync_all_org_module_admins(tenant.id)
            member_rows = session.scalars(
                sa.select(SecUserModule).where(
                    SecUserModule.tenant_id == tenant.id,
                    SecUserModule.module_key == "service",
                    SecUserModule.role == MODULE_ROLE_MEMBER,
                )
            ).all()
            for row in member_rows:
                user = session.get(SecUser, row.user_id)
                ctx = TenantContext(
                    tenant_id=tenant.id,
                    user_id=row.user_id,
                    user_type=user.user_type if user else "employee",
                )
                sync.promote_service_engineer(ctx, row.user_id, None)
            # Also promote admins that sync_all already covered; ensure engineer demotion done.
            admin_rows = session.scalars(
                sa.select(SecUserModule).where(
                    SecUserModule.tenant_id == tenant.id,
                    SecUserModule.module_key == "service",
                    SecUserModule.role == MODULE_ROLE_ADMIN,
                )
            ).all()
            for row in admin_rows:
                user = session.get(SecUser, row.user_id)
                ctx = TenantContext(
                    tenant_id=tenant.id,
                    user_id=row.user_id,
                    user_type=user.user_type if user else "employee",
                )
                sync._promote_service(ctx, row.user_id, None)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    pass
