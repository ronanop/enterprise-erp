"""Create QmInspectionPlan table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0118_qm_inspection_plan"
down_revision: str | None = "0117_qm_defect_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.inspection_plan import QmInspectionPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    QmInspectionPlan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.inspection_plan import QmInspectionPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    QmInspectionPlan.__table__.drop(bind=op.get_bind(), checkfirst=True)
