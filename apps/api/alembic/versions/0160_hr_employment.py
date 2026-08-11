"""Create HrEmployment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import create_orm_table_defer_columns  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: F401

revision: str = "0160_hr_employment"
down_revision: str | None = "0159_hr_employee_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFER = {"management_group_id"}


def upgrade() -> None:
    create_orm_table_defer_columns(
        HrEmployment.__table__,
        op.get_bind(),
        _DEFER,
    )


def downgrade() -> None:
    HrEmployment.__table__.drop(bind=op.get_bind(), checkfirst=True)
