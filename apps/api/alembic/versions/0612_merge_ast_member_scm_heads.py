"""Merge asset member-workspace head with SCM/Recording-46 migration head."""

from collections.abc import Sequence

revision: str = "0612_merge_ast_member_scm_heads"
down_revision: tuple[str, str] | None = (
    "0608_ast_member_workspace_reads",
    "0611_hr_exit_agreement",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
