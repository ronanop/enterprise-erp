"""Add Sales CRM (Zoho-replacement) tables and sales-process columns."""

from collections.abc import Sequence

from alembic import op

revision: str = "0445_crm_sales_process"
down_revision: str | None = "0444_fin_fiscal_year_meta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.approval_task import CrmApprovalTask  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.approval_task import CrmApprovalTask  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.drop(bind=op.get_bind(), checkfirst=True)
