"""Repair asset schema gaps when stamped migrations were not fully applied."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0581_ast_schema_repair_stamped_gaps"
down_revision: str | None = "0580_ast_operational_in_maintenance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"

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


def _has_column(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    return column in {c["name"] for c in insp.get_columns(table, schema=SCHEMA)}


def _has_check_constraint(name: str, table: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = :schema
              AND t.relname = :table
              AND c.conname = :name
              AND c.contype = 'c'
            LIMIT 1
            """
        ),
        {"schema": SCHEMA, "table": table, "name": name},
    ).first()
    return row is not None


def _has_fk(name: str, table: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = :schema
              AND t.relname = :table
              AND c.conname = :name
              AND c.contype = 'f'
            LIMIT 1
            """
        ),
        {"schema": SCHEMA, "table": table, "name": name},
    ).first()
    return row is not None


def _has_index(name: str) -> bool:
    conn = op.get_bind()
    row = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = :schema AND indexname = :name
            LIMIT 1
            """
        ),
        {"schema": SCHEMA, "name": name},
    ).first()
    return row is not None


def upgrade() -> None:
    # 0570_ast_assignment_manual_employee — assignment columns
    assignment_columns: list[tuple[str, sa.Column]] = [
        ("employee_source", sa.Column("employee_source", sa.String(length=20), nullable=True)),
        ("manual_employee_name", sa.Column("manual_employee_name", sa.String(length=255), nullable=True)),
        ("manual_employee_phone", sa.Column("manual_employee_phone", sa.String(length=30), nullable=True)),
        ("manual_employee_email", sa.Column("manual_employee_email", sa.String(length=255), nullable=True)),
        (
            "manual_employee_deployed_to",
            sa.Column("manual_employee_deployed_to", sa.String(length=255), nullable=True),
        ),
    ]
    for name, column in assignment_columns:
        if not _has_column("ast_asset_assignment", name):
            op.add_column("ast_asset_assignment", column, schema=SCHEMA)

    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset_assignment
            SET employee_source = 'MASTER_DATA'
            WHERE allocation_type = 'employee'
              AND employee_id IS NOT NULL
              AND employee_source IS NULL
              AND is_deleted = false
            """
        )
    )

    if not _has_check_constraint("ck_ast_asset_assignment_employee_source", "ast_asset_assignment"):
        op.create_check_constraint(
            "ck_ast_asset_assignment_employee_source",
            "ast_asset_assignment",
            "employee_source IS NULL OR employee_source IN ('MASTER_DATA','MANUAL_ENTRY')",
            schema=SCHEMA,
        )

    # Replace legacy identity check with the current rule set.
    op.execute(
        sa.text(
            "ALTER TABLE asset.ast_asset_assignment "
            "DROP CONSTRAINT IF EXISTS ck_ast_asset_assignment_employee_identity"
        )
    )
    op.create_check_constraint(
        "ck_ast_asset_assignment_employee_identity",
        "ast_asset_assignment",
        _EMPLOYEE_IDENTITY_CHECK,
        schema=SCHEMA,
    )

    # 0578_ast_component_asset_link — component_asset_id + indexes
    if not _has_column("ast_asset_component", "component_asset_id"):
        op.add_column(
            "ast_asset_component",
            sa.Column("component_asset_id", sa.Uuid(), nullable=True),
            schema=SCHEMA,
        )

    if not _has_fk("fk_ast_asset_component_component_asset_id", "ast_asset_component"):
        op.create_foreign_key(
            "fk_ast_asset_component_component_asset_id",
            "ast_asset_component",
            "ast_asset",
            ["component_asset_id"],
            ["id"],
            source_schema=SCHEMA,
            referent_schema=SCHEMA,
            ondelete="RESTRICT",
        )

    if not _has_index("ix_ast_asset_component_component_asset_id"):
        op.create_index(
            "ix_ast_asset_component_component_asset_id",
            "ast_asset_component",
            ["component_asset_id"],
            unique=False,
            schema=SCHEMA,
        )

    if not _has_index("uq_ast_asset_component_one_active_child_asset"):
        op.execute(
            sa.text(
                """
                CREATE UNIQUE INDEX uq_ast_asset_component_one_active_child_asset
                ON asset.ast_asset_component (component_asset_id)
                WHERE status = 'active'
                  AND is_deleted = false
                  AND component_asset_id IS NOT NULL
                """
            )
        )


def downgrade() -> None:
    op.execute(
        sa.text("DROP INDEX IF EXISTS asset.uq_ast_asset_component_one_active_child_asset")
    )
    op.execute(
        sa.text(
            "ALTER TABLE asset.ast_asset_component "
            "DROP CONSTRAINT IF EXISTS fk_ast_asset_component_component_asset_id"
        )
    )
    op.execute(
        sa.text("DROP INDEX IF EXISTS asset.ix_ast_asset_component_component_asset_id")
    )
    for column in (
        "component_asset_id",
        "manual_employee_deployed_to",
        "manual_employee_email",
        "manual_employee_phone",
        "manual_employee_name",
        "employee_source",
    ):
        if _has_column(
            "ast_asset_component" if column == "component_asset_id" else "ast_asset_assignment",
            column,
        ):
            op.drop_column(
                "ast_asset_component" if column == "component_asset_id" else "ast_asset_assignment",
                column,
                schema=SCHEMA,
            )
    op.execute(
        sa.text(
            "ALTER TABLE asset.ast_asset_assignment "
            "DROP CONSTRAINT IF EXISTS ck_ast_asset_assignment_employee_identity"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE asset.ast_asset_assignment "
            "DROP CONSTRAINT IF EXISTS ck_ast_asset_assignment_employee_source"
        )
    )
