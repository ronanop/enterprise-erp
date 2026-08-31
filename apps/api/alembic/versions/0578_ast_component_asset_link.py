"""Components Part 2: component_asset_id, eligible_as_component, IN_USE_AS_COMPONENT.

- Nullable FK ast_asset_component.component_asset_id → ast_asset.id
- Partial unique: one active parent attachment per child asset
- ast_asset_type.eligible_as_component (Laptop=false, others=true)
- Expand ck_ast_asset_operational_status for IN_USE_AS_COMPONENT
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0578_ast_component_asset_link"
down_revision: str | None = "0577_ast_asset_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset_component",
        sa.Column("component_asset_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.create_foreign_key(
        "fk_ast_asset_component_component_asset_id",
        "ast_asset_component",
        "ast_asset",
        ["component_asset_id"],
        ["id"],
        source_schema="asset",
        referent_schema="asset",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_ast_asset_component_component_asset_id",
        "ast_asset_component",
        ["component_asset_id"],
        unique=False,
        schema="asset",
    )
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

    op.add_column(
        "ast_asset_type",
        sa.Column(
            "eligible_as_component",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        schema="asset",
    )
    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset_type
            SET eligible_as_component = false
            WHERE lower(name) = 'laptop' AND is_deleted = false
            """
        )
    )

    op.drop_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        schema="asset",
        type_="check",
    )
    op.create_check_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        "operational_status IS NULL OR operational_status IN "
        "('READY_TO_MOVE','ASSIGNED','RETIRED','PENDING_DISPOSAL','DISPOSED',"
        "'IN_USE_AS_COMPONENT')",
        schema="asset",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset
            SET operational_status = 'READY_TO_MOVE'
            WHERE operational_status = 'IN_USE_AS_COMPONENT' AND is_deleted = false
            """
        )
    )
    op.drop_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        schema="asset",
        type_="check",
    )
    op.create_check_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        "operational_status IS NULL OR operational_status IN "
        "('READY_TO_MOVE','ASSIGNED','RETIRED','PENDING_DISPOSAL','DISPOSED')",
        schema="asset",
    )

    op.drop_column("ast_asset_type", "eligible_as_component", schema="asset")

    op.execute(
        sa.text("DROP INDEX IF EXISTS asset.uq_ast_asset_component_one_active_child_asset")
    )
    op.drop_index(
        "ix_ast_asset_component_component_asset_id",
        table_name="ast_asset_component",
        schema="asset",
    )
    op.drop_constraint(
        "fk_ast_asset_component_component_asset_id",
        "ast_asset_component",
        schema="asset",
        type_="foreignkey",
    )
    op.drop_column("ast_asset_component", "component_asset_id", schema="asset")
