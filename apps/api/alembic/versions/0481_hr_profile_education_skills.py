"""Add education_json and skills_json to hr.hr_employee_profile."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0481_hr_profile_education_skills"
down_revision: str | None = "0480_super_admin_role_polish"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_employee_profile",
        sa.Column("education_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_employee_profile",
        sa.Column("skills_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_employee_profile", "skills_json", schema="hr")
    op.drop_column("hr_employee_profile", "education_json", schema="hr")
