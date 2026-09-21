"""Add ast_asset_component.component_asset_id skipped when 0507 was stamped.

0507 also added ast_asset_type.eligible_as_component. That column already
existed, so the revision was stamped and component_asset_id was never
created. GET /assets/asset-components then 500s and the assignment wizard
shows Internal server error.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0512_ast_component_asset_id_repair"
down_revision: str | None = "0511_ast_assignment_manual_employee_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("ast_asset_component", schema="asset")}
    fks = {fk["name"] for fk in insp.get_foreign_keys("ast_asset_component", schema="asset") if fk.get("name")}
    indexes = {i["name"] for i in insp.get_indexes("ast_asset_component", schema="asset") if i.get("name")}

    if "component_asset_id" not in cols:
        op.add_column(
            "ast_asset_component",
            sa.Column("component_asset_id", sa.Uuid(), nullable=True),
            schema="asset",
        )
    if "fk_ast_asset_component_component_asset_id" not in fks:
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
    if "ix_ast_asset_component_component_asset_id" not in indexes:
        op.create_index(
            "ix_ast_asset_component_component_asset_id",
            "ast_asset_component",
            ["component_asset_id"],
            unique=False,
            schema="asset",
        )
    if "uq_ast_asset_component_one_active_child_asset" not in indexes:
        op.execute(
            sa.text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_ast_asset_component_one_active_child_asset
                ON asset.ast_asset_component (component_asset_id)
                WHERE status = 'active'
                  AND is_deleted = false
                  AND component_asset_id IS NOT NULL
                """
            )
        )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS asset.uq_ast_asset_component_one_active_child_asset"))
    bind = op.get_bind()
    insp = sa.inspect(bind)
    indexes = {i["name"] for i in insp.get_indexes("ast_asset_component", schema="asset") if i.get("name")}
    fks = {fk["name"] for fk in insp.get_foreign_keys("ast_asset_component", schema="asset") if fk.get("name")}
    cols = {c["name"] for c in insp.get_columns("ast_asset_component", schema="asset")}
    if "ix_ast_asset_component_component_asset_id" in indexes:
        op.drop_index(
            "ix_ast_asset_component_component_asset_id",
            table_name="ast_asset_component",
            schema="asset",
        )
    if "fk_ast_asset_component_component_asset_id" in fks:
        op.drop_constraint(
            "fk_ast_asset_component_component_asset_id",
            "ast_asset_component",
            schema="asset",
            type_="foreignkey",
        )
    if "component_asset_id" in cols:
        op.drop_column("ast_asset_component", "component_asset_id", schema="asset")
