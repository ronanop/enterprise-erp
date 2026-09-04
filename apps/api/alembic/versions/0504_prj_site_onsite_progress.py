"""Add On-site workflow stage, progress/remarks, and handover person name."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0504_prj_site_onsite_progress"
down_revision: str | Sequence[str] | None = "0503_prj_site_stage_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STRING_COLS = (
    ("onsite_attachment_name", 255),
    ("survey_progress_status", 40),
    ("scm_progress_status", 40),
    ("onsite_progress_status", 40),
    ("installation_progress_status", 40),
    ("acceptance_progress_status", 40),
    ("material_handover_to_name", 255),
)

_TEXT_COLS = (
    "survey_remarks",
    "scm_remarks",
    "onsite_remarks",
    "installation_remarks",
    "acceptance_remarks",
)


def upgrade() -> None:
    op.drop_constraint("ck_prj_site_workflow_stage", "prj_site_installation", schema="project")
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        "prj_site_installation",
        "workflow_stage IN ("
        "'intake','assignment','survey','scm','onsite','installation','acceptance','completed'"
        ")",
        schema="project",
    )

    op.add_column(
        "prj_site_installation",
        sa.Column("onsite_assignee_employee_id", sa.UUID(), nullable=True),
        schema="project",
    )
    op.create_foreign_key(
        "fk_prj_site_onsite_assignee",
        "prj_site_installation",
        "master_employee",
        ["onsite_assignee_employee_id"],
        ["id"],
        source_schema="project",
        referent_schema="master",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_prj_site_onsite_assignee",
        "prj_site_installation",
        ["onsite_assignee_employee_id"],
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("onsite_assigned_date", sa.Date(), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("onsite_finished_date", sa.Date(), nullable=True),
        schema="project",
    )

    for col, length in _STRING_COLS:
        op.add_column(
            "prj_site_installation",
            sa.Column(col, sa.String(length=length), nullable=True),
            schema="project",
        )
    for col in _TEXT_COLS:
        op.add_column(
            "prj_site_installation",
            sa.Column(col, sa.Text(), nullable=True),
            schema="project",
        )


def downgrade() -> None:
    for col in reversed(_TEXT_COLS):
        op.drop_column("prj_site_installation", col, schema="project")
    for col, _ in reversed(_STRING_COLS):
        op.drop_column("prj_site_installation", col, schema="project")

    op.drop_index("ix_prj_site_onsite_assignee", table_name="prj_site_installation", schema="project")
    op.drop_constraint("fk_prj_site_onsite_assignee", "prj_site_installation", schema="project")
    op.drop_column("prj_site_installation", "onsite_finished_date", schema="project")
    op.drop_column("prj_site_installation", "onsite_assigned_date", schema="project")
    op.drop_column("prj_site_installation", "onsite_assignee_employee_id", schema="project")

    op.drop_constraint("ck_prj_site_workflow_stage", "prj_site_installation", schema="project")
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        "prj_site_installation",
        "workflow_stage IN ("
        "'intake','assignment','survey','scm','installation','acceptance','completed'"
        ")",
        schema="project",
    )
