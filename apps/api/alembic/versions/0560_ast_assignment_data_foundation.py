"""CR-004 Phase 5A-1: assignment Excel data foundation columns."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0560_ast_assignment_data_foundation"
down_revision: str | None = "0559_ast_operational_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_assignment"

STATUS_CHECK = "ck_ast_asset_assignment_delivery_reference_status"

REFERENCE_STATUSES = ("not_applicable", "pending", "issued", "received")


def _column_names(bind: sa.Connection) -> set[str]:
    insp = sa.inspect(bind)
    return {c["name"] for c in insp.get_columns(TABLE, schema=SCHEMA)}


def _drop_legacy_issuance_columns(bind: sa.Connection) -> None:
    """Remove partial Phase 5A draft columns if present (pre-rename)."""
    insp = sa.inspect(bind)
    checks = {c["name"] for c in insp.get_check_constraints(TABLE, schema=SCHEMA)}
    for name in (
        "ck_ast_asset_assignment_return_condition",
        "ck_ast_asset_assignment_challan_status",
    ):
        if name in checks:
            op.drop_constraint(name, TABLE, schema=SCHEMA, type_="check")

    cols = _column_names(bind)
    for name in (
        "return_condition",
        "remarks",
        "delivery_challan_status",
        "delivery_challan_ref",
    ):
        if name in cols:
            op.drop_column(TABLE, name, schema=SCHEMA)


def upgrade() -> None:
    bind = op.get_bind()
    _drop_legacy_issuance_columns(bind)
    cols = _column_names(bind)

    if "delivery_reference_number" not in cols:
        op.add_column(
            TABLE,
            sa.Column("delivery_reference_number", sa.String(length=100), nullable=True),
            schema=SCHEMA,
        )
    if "delivery_reference_status" not in cols:
        op.add_column(
            TABLE,
            sa.Column(
                "delivery_reference_status",
                sa.String(length=30),
                nullable=False,
                server_default="not_applicable",
            ),
            schema=SCHEMA,
        )
    if "assignment_remarks" not in cols:
        op.add_column(
            TABLE,
            sa.Column("assignment_remarks", sa.Text(), nullable=True),
            schema=SCHEMA,
        )
    if "return_remarks" not in cols:
        op.add_column(
            TABLE,
            sa.Column("return_remarks", sa.Text(), nullable=True),
            schema=SCHEMA,
        )

    insp = sa.inspect(bind)
    checks = {c["name"] for c in insp.get_check_constraints(TABLE, schema=SCHEMA)}
    if STATUS_CHECK not in checks:
        op.create_check_constraint(
            STATUS_CHECK,
            TABLE,
            "delivery_reference_status IN ("
            + ", ".join(repr(s) for s in REFERENCE_STATUSES)
            + ")",
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    checks = {c["name"] for c in insp.get_check_constraints(TABLE, schema=SCHEMA)}
    if STATUS_CHECK in checks:
        op.drop_constraint(STATUS_CHECK, TABLE, schema=SCHEMA, type_="check")

    cols = _column_names(bind)
    for name in (
        "return_remarks",
        "assignment_remarks",
        "delivery_reference_status",
        "delivery_reference_number",
    ):
        if name in cols:
            op.drop_column(TABLE, name, schema=SCHEMA)
