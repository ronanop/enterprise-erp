"""Create PrjResourceAllocation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0232_prj_resource_allocation"
down_revision: str | None = "0231_prj_resource_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.resource_allocation import PrjResourceAllocation  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjResourceAllocation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.resource_allocation import PrjResourceAllocation  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjResourceAllocation.__table__.drop(bind=op.get_bind(), checkfirst=True)
