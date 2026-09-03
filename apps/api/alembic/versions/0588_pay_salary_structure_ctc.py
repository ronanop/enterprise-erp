"""Add Excel CTC / formula columns on pay_salary_structure."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0588_pay_salary_structure_ctc"
down_revision: str | None = "0587_grant_proc_master_vendor_reads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "pay_salary_structure"
_SCHEMA = "payroll"

_COLUMNS = (
    sa.Column("gross_ctc", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("basic_percent", sa.Numeric(9, 4), nullable=False, server_default="0.6000"),
    sa.Column("hra_percent_of_basic", sa.Numeric(9, 4), nullable=False, server_default="0.5000"),
    sa.Column("telephone_allowance", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("employer_contribution", sa.Numeric(18, 4), nullable=False, server_default="1800"),
    sa.Column("basic_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("hra_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("special_allowance", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("ctc_amount", sa.Numeric(18, 4), nullable=False, server_default="0"),
    sa.Column("pf_percent", sa.Numeric(9, 4), nullable=False, server_default="0.1200"),
    sa.Column("pf_wage_ceiling", sa.Numeric(18, 4), nullable=False, server_default="15000"),
    sa.Column("pf_fixed_ceiling", sa.Numeric(18, 4), nullable=False, server_default="1800"),
    sa.Column("edli_admin_amount", sa.Numeric(18, 4), nullable=False, server_default="100"),
    sa.Column("esi_percent", sa.Numeric(9, 4), nullable=False, server_default="0.0075"),
    sa.Column("esi_monthly_ceiling", sa.Numeric(18, 4), nullable=False, server_default="21000"),
)


def upgrade() -> None:
    for column in _COLUMNS:
        add_column_if_missing(_TABLE, column, schema=_SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = {c["name"] for c in insp.get_columns(_TABLE, schema=_SCHEMA)}
    for col in reversed([c.name for c in _COLUMNS]):
        if col in existing:
            op.drop_column(_TABLE, col, schema=_SCHEMA)
