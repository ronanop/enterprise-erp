"""Widen audit.audit_log.operation for stage advance labels.

Site installation audits use values like
``advance:complete_onsite_delivery`` (32) and
``stage_saved_alert:material_handover`` (35), which exceed the old
VARCHAR(30) and raise DataError on Onsite Delivery / Material Handover save.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0613_audit_operation_widen"
down_revision: str | Sequence[str] | None = "0612_merge_ast_member_scm_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "audit_log",
        "operation",
        existing_type=sa.String(length=30),
        type_=sa.String(length=80),
        existing_nullable=False,
        schema="audit",
    )


def downgrade() -> None:
    op.alter_column(
        "audit_log",
        "operation",
        existing_type=sa.String(length=80),
        type_=sa.String(length=30),
        existing_nullable=False,
        schema="audit",
    )
