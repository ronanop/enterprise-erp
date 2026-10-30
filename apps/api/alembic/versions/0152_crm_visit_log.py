"""Create CrmVisitLog table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0152_crm_visit_log"
down_revision: str | None = "0151_crm_email_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.visit_log import CrmVisitLog  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmVisitLog.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.visit_log import CrmVisitLog  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmVisitLog.__table__.drop(bind=op.get_bind(), checkfirst=True)
