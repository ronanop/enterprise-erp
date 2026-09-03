"""Payroll policy: fixed-30 salary basis, sandwich, configurable PF."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0589_pay_policy_fixed_30_sandwich_pf"
down_revision: str | None = "0588_pay_salary_structure_ctc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "pay_payroll_policy"
_SCHEMA = "payroll"


def _check_names(bind: sa.Connection) -> set[str]:
    insp = sa.inspect(bind)
    return {c["name"] for c in insp.get_check_constraints(_TABLE, schema=_SCHEMA)}


def upgrade() -> None:
    add_column_if_missing(
        _TABLE,
        sa.Column("pf_employee_percent", sa.Numeric(9, 4), nullable=True, server_default="0.1200"),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("pf_employer_percent", sa.Numeric(9, 4), nullable=True, server_default="0.1200"),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("pf_wage_ceiling", sa.Numeric(18, 4), nullable=True, server_default="15000"),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("pf_on_lop", sa.String(40), nullable=False, server_default="fixed"),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("sandwich_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("sandwich_off_becomes", sa.String(20), nullable=False, server_default="lop"),
        schema=_SCHEMA,
    )
    add_column_if_missing(
        _TABLE,
        sa.Column("sandwich_triggers", sa.String(40), nullable=False, server_default="unauthorized_absence"),
        schema=_SCHEMA,
    )

    checks = _check_names(op.get_bind())
    if "ck_pay_policy_pf_mode" in checks:
        op.drop_constraint("ck_pay_policy_pf_mode", _TABLE, schema=_SCHEMA, type_="check")
        checks.discard("ck_pay_policy_pf_mode")
    if "ck_pay_policy_pf_mode" not in checks:
        op.create_check_constraint(
            "ck_pay_policy_pf_mode",
            _TABLE,
            "pf_mode IN ('fixed_split','fixed_total','statutory_percent','percentage')",
            schema=_SCHEMA,
        )
    if "ck_pay_policy_pf_on_lop" not in checks:
        op.create_check_constraint(
            "ck_pay_policy_pf_on_lop",
            _TABLE,
            "pf_on_lop IN ('fixed','prorated','percentage_of_pf_wage')",
            schema=_SCHEMA,
        )
    if "ck_pay_policy_sandwich_outcome" not in checks:
        op.create_check_constraint(
            "ck_pay_policy_sandwich_outcome",
            _TABLE,
            "sandwich_off_becomes IN ('lop','leave')",
            schema=_SCHEMA,
        )
    if "ck_pay_policy_sandwich_trigger" not in checks:
        op.create_check_constraint(
            "ck_pay_policy_sandwich_trigger",
            _TABLE,
            "sandwich_triggers IN ('unauthorized_absence','approved_leave','both')",
            schema=_SCHEMA,
        )

    op.execute(
        sa.text(
            "UPDATE payroll.pay_payroll_policy "
            "SET period_day_denominator = 'fixed_30', "
            "salary_proration_mode = 'fixed_30_day_factor' "
            "WHERE is_deleted = false"
        )
    )


def downgrade() -> None:
    checks = _check_names(op.get_bind())
    for name in (
        "ck_pay_policy_sandwich_trigger",
        "ck_pay_policy_sandwich_outcome",
        "ck_pay_policy_pf_on_lop",
        "ck_pay_policy_pf_mode",
    ):
        if name in checks:
            op.drop_constraint(name, _TABLE, schema=_SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_pay_policy_pf_mode",
        _TABLE,
        "pf_mode IN ('fixed_split','fixed_total','statutory_percent')",
        schema=_SCHEMA,
    )
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns(_TABLE, schema=_SCHEMA)}
    for col in (
        "sandwich_triggers",
        "sandwich_off_becomes",
        "sandwich_enabled",
        "pf_on_lop",
        "pf_wage_ceiling",
        "pf_employer_percent",
        "pf_employee_percent",
    ):
        if col in existing:
            op.drop_column(_TABLE, col, schema=_SCHEMA)
