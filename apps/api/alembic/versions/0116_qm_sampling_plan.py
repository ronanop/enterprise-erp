"""Create QmSamplingPlan table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0116_qm_sampling_plan"
down_revision: str | None = "0115_create_quality_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.sampling_plan import QmSamplingPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    QmSamplingPlan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.sampling_plan import QmSamplingPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    QmSamplingPlan.__table__.drop(bind=op.get_bind(), checkfirst=True)
