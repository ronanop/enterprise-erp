"""Add per-stage assigned / finished dates for site workflow tracking."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0471_site_stage_tracking_dates"
down_revision: str | None = "0470_merge_install_config_stage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

COLUMNS = (
    "survey_assigned_date",
    "survey_finished_date",
    "scm_assigned_date",
    "scm_finished_date",
    "installation_assigned_date",
    "installation_finished_date",
    "acceptance_assigned_date",
    "acceptance_finished_date",
)


def upgrade() -> None:
    for name in COLUMNS:
        add_column_if_missing(
            TABLE,
            sa.Column(name, sa.Date(), nullable=True),
            schema=SCHEMA,
        )

    # Survey starts on project/site creation; cascade finished/assigned for past stages.
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET survey_assigned_date = COALESCE(survey_assigned_date, created_at::date)
            WHERE is_deleted IS FALSE
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET
              survey_finished_date = COALESCE(survey_finished_date, created_at::date),
              scm_assigned_date = COALESCE(scm_assigned_date, created_at::date)
            WHERE is_deleted IS FALSE
              AND workflow_stage IN (
                'scm', 'installation', 'configuration', 'acceptance', 'completed'
              )
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET
              scm_finished_date = COALESCE(scm_finished_date, created_at::date),
              installation_assigned_date = COALESCE(installation_assigned_date, created_at::date)
            WHERE is_deleted IS FALSE
              AND workflow_stage IN (
                'installation', 'configuration', 'acceptance', 'completed'
              )
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET
              installation_finished_date = COALESCE(installation_finished_date, created_at::date),
              acceptance_assigned_date = COALESCE(acceptance_assigned_date, created_at::date)
            WHERE is_deleted IS FALSE
              AND workflow_stage IN ('acceptance', 'completed')
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET acceptance_finished_date = COALESCE(acceptance_finished_date, created_at::date)
            WHERE is_deleted IS FALSE
              AND workflow_stage = 'completed'
            """
        )
    )


def downgrade() -> None:
    for name in reversed(COLUMNS):
        op.drop_column(TABLE, name, schema=SCHEMA)
