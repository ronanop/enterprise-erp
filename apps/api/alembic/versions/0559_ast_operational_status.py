"""CR-004 Phase 2A: operational_status on ast_asset + data backfill."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0559_ast_operational_status"
down_revision: str | None = "0558_ast_discovery_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
ASSET_TABLE = "ast_asset"
ASSIGNMENT_TABLE = "ast_asset_assignment"
COLUMN = "operational_status"

OPS_VALUES = (
    "READY_TO_MOVE",
    "ASSIGNED",
    "RETIRED",
    "PENDING_DISPOSAL",
    "DISPOSED",
)
CHECK_NAME = "ck_ast_asset_operational_status"


def _column_names(bind: sa.Connection, table: str) -> set[str]:
    insp = sa.inspect(bind)
    return {c["name"] for c in insp.get_columns(table, schema=SCHEMA)}


def upgrade() -> None:
    bind = op.get_bind()
    cols = _column_names(bind, ASSET_TABLE)
    if COLUMN not in cols:
        op.add_column(
            ASSET_TABLE,
            sa.Column(COLUMN, sa.String(length=30), nullable=True),
            schema=SCHEMA,
        )
        op.create_index(
            f"ix_{SCHEMA}_{ASSET_TABLE}_{COLUMN}",
            ASSET_TABLE,
            [COLUMN],
            schema=SCHEMA,
        )

    # Backfill (idempotent): disposed → DISPOSED; active assignment → ASSIGNED; else READY_TO_MOVE
    disposed_list = ", ".join(f"'{v}'" for v in ("disposed", "written_off"))
    ops_disposed = OPS_VALUES[4]
    ops_assigned = OPS_VALUES[1]
    ops_ready = OPS_VALUES[0]

    bind.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{ASSET_TABLE} AS a
            SET {COLUMN} = :ops_disposed
            WHERE a.is_deleted = false
              AND a.status IN ({disposed_list})
            """
        ),
        {"ops_disposed": ops_disposed},
    )

    bind.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{ASSET_TABLE} AS a
            SET {COLUMN} = :ops_assigned
            WHERE a.is_deleted = false
              AND a.status NOT IN ({disposed_list})
              AND EXISTS (
                SELECT 1
                FROM {SCHEMA}.{ASSIGNMENT_TABLE} AS asn
                WHERE asn.asset_id = a.id
                  AND asn.is_deleted = false
                  AND asn.status = 'active'
              )
            """
        ),
        {"ops_assigned": ops_assigned},
    )

    bind.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{ASSET_TABLE} AS a
            SET {COLUMN} = :ops_ready
            WHERE a.is_deleted = false
              AND a.status NOT IN ({disposed_list})
              AND a.{COLUMN} IS NULL
            """
        ),
        {"ops_ready": ops_ready},
    )

    # CHECK constraint (add if missing)
    insp = sa.inspect(bind)
    existing_checks = {
        c["name"]
        for c in insp.get_check_constraints(ASSET_TABLE, schema=SCHEMA)
    }
    if CHECK_NAME not in existing_checks:
        values_sql = ", ".join(f"'{v}'" for v in OPS_VALUES)
        op.create_check_constraint(
            CHECK_NAME,
            ASSET_TABLE,
            f"{COLUMN} IS NULL OR {COLUMN} IN ({values_sql})",
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_checks = {
        c["name"]
        for c in insp.get_check_constraints(ASSET_TABLE, schema=SCHEMA)
    }
    if CHECK_NAME in existing_checks:
        op.drop_constraint(CHECK_NAME, ASSET_TABLE, schema=SCHEMA, type_="check")

    cols = _column_names(bind, ASSET_TABLE)
    if COLUMN in cols:
        op.drop_index(
            f"ix_{SCHEMA}_{ASSET_TABLE}_{COLUMN}",
            table_name=ASSET_TABLE,
            schema=SCHEMA,
        )
        op.drop_column(ASSET_TABLE, COLUMN, schema=SCHEMA)
