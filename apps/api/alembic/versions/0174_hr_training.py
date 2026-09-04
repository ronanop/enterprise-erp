"""Create HrTraining table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import create_orm_table_defer_columns  # noqa: E402
from modules.hr.models.training import HrTraining  # noqa: F401

revision: str = "0174_hr_training"
down_revision: str | None = "0173_hr_appraisal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Added in 0473_hr_training_rooms_requests (after hr_training_room exists).
_DEFER = {
    "start_time",
    "end_time",
    "room_id",
    "is_recurring",
    "recurrence_rule",
    "notes",
}


def upgrade() -> None:
    create_orm_table_defer_columns(
        HrTraining.__table__,
        op.get_bind(),
        _DEFER,
    )


def downgrade() -> None:
    HrTraining.__table__.drop(bind=op.get_bind(), checkfirst=True)
