"""Link projects to procurement purchase orders (PO → project pipeline)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0498_prj_project_proc_order"
down_revision: str | Sequence[str] | None = "0497_merge_proc_scm_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "prj_project",
        sa.Column("proc_order_id", sa.UUID(), nullable=True),
        schema="project",
    )
    op.create_foreign_key(
        "fk_prj_project_proc_order",
        "prj_project",
        "proc_order_header",
        ["proc_order_id"],
        ["id"],
        source_schema="project",
        referent_schema="procurement",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_prj_project_proc_order_id",
        "prj_project",
        ["proc_order_id"],
        unique=True,
        schema="project",
        postgresql_where=sa.text("proc_order_id IS NOT NULL AND is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_prj_project_proc_order_id",
        table_name="prj_project",
        schema="project",
    )
    op.drop_constraint(
        "fk_prj_project_proc_order",
        "prj_project",
        schema="project",
        type_="foreignkey",
    )
    op.drop_column("prj_project", "proc_order_id", schema="project")
