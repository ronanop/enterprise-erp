"""Add CRM OEM partner master table and backfill from leads."""

from collections.abc import Sequence

from alembic import op

revision: str = "0456_crm_oem_master"
down_revision: str | None = "0455_crm_lead_mobile_intl"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.oem import CrmOem  # noqa: E402,F401
    except ModuleNotFoundError:
        return
    E402,F401.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.oem import CrmOem  # noqa: E402,F401
    except ModuleNotFoundError:
        return
    E402,F401.__table__.drop(bind=op.get_bind(), checkfirst=True)
