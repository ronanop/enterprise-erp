"""Create CrmLeadSource table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0137_crm_lead_source"
down_revision: str | None = "0136_create_crm_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.lead_source import CrmLeadSource  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadSource.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.lead_source import CrmLeadSource  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadSource.__table__.drop(bind=op.get_bind(), checkfirst=True)
