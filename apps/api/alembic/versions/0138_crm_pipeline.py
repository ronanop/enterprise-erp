"""Create CrmPipeline table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0138_crm_pipeline"
down_revision: str | None = "0137_crm_lead_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.pipeline import CrmPipeline  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmPipeline.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.pipeline import CrmPipeline  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmPipeline.__table__.drop(bind=op.get_bind(), checkfirst=True)
