"""Create HrEmployment table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op
from sqlalchemy import inspect

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.hr.models.employment import HrEmployment  # noqa: F401

revision: str = "0160_hr_employment"
down_revision: str | None = "0159_hr_employee_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    table = HrEmployment.__table__
    if inspect(bind).has_table("hr_employment", schema="hr"):
        return
    col = table.c.management_group_id
    table._columns.remove(col)
    try:
        table.create(bind=bind, checkfirst=True)
    finally:
        table._columns.add(col)


def downgrade() -> None:
    HrEmployment.__table__.drop(bind=op.get_bind(), checkfirst=True)
