"""Merge divergent alembic heads after HRMS dual-numbering on main.

Revision ID: 0665_merge_hrms_alembic_heads
Revises: 0646_master_employee_is_manager, 0657_rec_job_posting_audience_evidence, 0664_rec_job_posting_audience_evidence
Create Date: 2026-11-02
"""

from collections.abc import Sequence

revision: str = "0665_merge_hrms_alembic_heads"
down_revision: str | Sequence[str] | None = (
    "0646_master_employee_is_manager",
    "0657_rec_job_posting_audience_evidence",
    "0664_rec_job_posting_audience_evidence",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Schema already applied on each branch; merge only.
    pass


def downgrade() -> None:
    pass
