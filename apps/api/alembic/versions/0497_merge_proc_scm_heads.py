"""Merge procurement SCM branch with CRM/project head."""

from collections.abc import Sequence

from alembic import op

revision: str = "0497_merge_proc_scm_heads"
down_revision: str | Sequence[str] | None = (
    "0480_crm_ovf_scm_on_hold_remark",
    "0493_crm_cloud_onboarding",
    "0496_sec_user_module",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
