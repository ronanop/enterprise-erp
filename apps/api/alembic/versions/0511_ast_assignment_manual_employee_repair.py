"""Add assignment manual-employee columns skipped when 0499 was stamped.

0499 also added ast_dc_challan.deployed_to. That column already existed, so
upgrade was skipped via stamp and ast_asset_assignment never received
employee_source / manual_* fields. Listing assignments then 500s and the
IT inventory page fails even though ast_asset itself is queryable.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0511_ast_assignment_manual_employee_repair"
down_revision: str | None = "0510_ast_disposal_remarks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EMPLOYEE_IDENTITY_CHECK = (
    "("
    "("
    "allocation_type = 'employee' "
    "AND employee_source = 'MASTER_DATA' "
    "AND employee_id IS NOT NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ") OR ("
    "allocation_type = 'employee' "
    "AND employee_source = 'MANUAL_ENTRY' "
    "AND employee_id IS NULL "
    "AND manual_employee_name IS NOT NULL AND trim(manual_employee_name) <> '' "
    "AND manual_employee_phone IS NOT NULL AND trim(manual_employee_phone) <> '' "
    "AND manual_employee_deployed_to IS NOT NULL AND trim(manual_employee_deployed_to) <> ''"
    ") OR ("
    "allocation_type <> 'employee' "
    "AND employee_id IS NULL "
    "AND employee_source IS NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ")"
    ")"
)


def _column_names(insp, table: str) -> set[str]:
    return {c["name"] for c in insp.get_columns(table, schema="asset")}


def _check_names(insp, table: str) -> set[str]:
    return {c["name"] for c in insp.get_check_constraints(table, schema="asset") if c["name"]}


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = _column_names(insp, "ast_asset_assignment")
    checks = _check_names(insp, "ast_asset_assignment")

    for name, col in (
        ("employee_source", sa.Column("employee_source", sa.String(length=20), nullable=True)),
        ("manual_employee_name", sa.Column("manual_employee_name", sa.String(length=255), nullable=True)),
        ("manual_employee_phone", sa.Column("manual_employee_phone", sa.String(length=30), nullable=True)),
        ("manual_employee_email", sa.Column("manual_employee_email", sa.String(length=255), nullable=True)),
        (
            "manual_employee_deployed_to",
            sa.Column("manual_employee_deployed_to", sa.String(length=255), nullable=True),
        ),
    ):
        if name not in cols:
            op.add_column("ast_asset_assignment", col, schema="asset")

    op.execute(
        sa.text(
            "UPDATE asset.ast_asset_assignment "
            "SET employee_source = 'MASTER_DATA' "
            "WHERE allocation_type = 'employee' "
            "AND employee_id IS NOT NULL "
            "AND employee_source IS NULL "
            "AND is_deleted = false"
        )
    )

    if "ck_ast_asset_assignment_employee_source" not in checks:
        op.create_check_constraint(
            "ck_ast_asset_assignment_employee_source",
            "ast_asset_assignment",
            "employee_source IS NULL OR employee_source IN ('MASTER_DATA','MANUAL_ENTRY')",
            schema="asset",
        )
    if "ck_ast_asset_assignment_employee_identity" not in checks:
        op.create_check_constraint(
            "ck_ast_asset_assignment_employee_identity",
            "ast_asset_assignment",
            _EMPLOYEE_IDENTITY_CHECK,
            schema="asset",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    checks = _check_names(insp, "ast_asset_assignment")
    cols = _column_names(insp, "ast_asset_assignment")
    if "ck_ast_asset_assignment_employee_identity" in checks:
        op.drop_constraint(
            "ck_ast_asset_assignment_employee_identity",
            "ast_asset_assignment",
            schema="asset",
            type_="check",
        )
    if "ck_ast_asset_assignment_employee_source" in checks:
        op.drop_constraint(
            "ck_ast_asset_assignment_employee_source",
            "ast_asset_assignment",
            schema="asset",
            type_="check",
        )
    for name in (
        "manual_employee_deployed_to",
        "manual_employee_email",
        "manual_employee_phone",
        "manual_employee_name",
        "employee_source",
    ):
        if name in cols:
            op.drop_column("ast_asset_assignment", name, schema="asset")
