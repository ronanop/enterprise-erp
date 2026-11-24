"""CRM tenant settings overlay for ERP-admin Settings."""

from collections.abc import Sequence

from alembic import op

from modules.crm.models.tenant_settings import CrmTenantSettings

revision: str = "0673_crm_tenant_settings"
down_revision: str | Sequence[str] | None = "0672_mkt_chat_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS crm")
    bind = op.get_bind()
    CrmTenantSettings.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS crm.crm_tenant_settings")
