"""Create HR workplace task allocation tables for ESS."""

from collections.abc import Sequence

from alembic import op

from modules.hr.models.workplace_task import (
    HrWorkplaceTask,
    HrWorkplaceTaskAssignee,
    HrWorkplaceTaskEvent,
)

revision: str = "0676_hr_workplace_task"
down_revision: str | Sequence[str] | None = "0675_hr_att_corr_status_manager"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS hr")
    bind = op.get_bind()
    HrWorkplaceTask.__table__.create(bind=bind, checkfirst=True)
    HrWorkplaceTaskAssignee.__table__.create(bind=bind, checkfirst=True)
    HrWorkplaceTaskEvent.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    HrWorkplaceTaskEvent.__table__.drop(bind=bind, checkfirst=True)
    HrWorkplaceTaskAssignee.__table__.drop(bind=bind, checkfirst=True)
    HrWorkplaceTask.__table__.drop(bind=bind, checkfirst=True)
