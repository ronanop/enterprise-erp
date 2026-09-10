"""Add control-plan fields to characteristic and inspection plan (nullable)."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0494_qm_char_reaction_plan"
down_revision: str | None = "0493_crm_cloud_onboarding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "qm_quality_characteristic",
        sa.Column("reaction_plan", sa.Text(), nullable=True),
        schema="quality",
    )
    add_column_if_missing(
        "qm_quality_characteristic",
        sa.Column("control_method", sa.String(50), nullable=True),
        schema="quality",
    )
    add_column_if_missing(
        "qm_quality_characteristic",
        sa.Column("sample_frequency", sa.String(50), nullable=True),
        schema="quality",
    )
    add_column_if_missing(
        "qm_inspection_plan",
        sa.Column("revision", sa.String(20), nullable=True),
        schema="quality",
    )
    add_column_if_missing(
        "qm_inspection_plan",
        sa.Column("process_name", sa.String(255), nullable=True),
        schema="quality",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("qm_inspection_plan", "process_name", schema="quality")
    op.drop_column("qm_inspection_plan", "revision", schema="quality")
    op.drop_column("qm_quality_characteristic", "sample_frequency", schema="quality")
    op.drop_column("qm_quality_characteristic", "control_method", schema="quality")
    op.drop_column("qm_quality_characteristic", "reaction_plan", schema="quality")
