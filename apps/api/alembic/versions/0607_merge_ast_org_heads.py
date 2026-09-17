"""Merge orphan org-department head with asset workspace reads head."""

from collections.abc import Sequence

revision: str = "0607_merge_ast_org_heads"
down_revision: tuple[str, str] | None = (
    "0588_org_department_module",
    "0606_ast_workspace_org_reads",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
