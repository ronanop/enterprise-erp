"""Create CrmLead table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0140_crm_lead"
down_revision: str | None = "0139_crm_campaign"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.company import CrmCompany  # noqa: F401
        from modules.crm.models.lead import CrmLead  # noqa: F401
    except ModuleNotFoundError:
        return
    bind = op.get_bind()
    # No earlier revision creates crm_company; lead FKs require it.
    CrmCompany.__table__.create(bind=bind, checkfirst=True)
    CrmLead.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.company import CrmCompany  # noqa: F401
        from modules.crm.models.lead import CrmLead  # noqa: F401
    except ModuleNotFoundError:
        return
    bind = op.get_bind()
    CrmLead.__table__.drop(bind=bind, checkfirst=True)
    CrmCompany.__table__.drop(bind=bind, checkfirst=True)
