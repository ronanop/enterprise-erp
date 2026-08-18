"""Split onsite into onsite_delivery + material_handover stages."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0507_prj_split_onsite_stages"
down_revision: str | Sequence[str] | None = "0506_crm_vyuha_entity_gst"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

_STAGES = (
    "'intake','assignment','survey','scm','onsite',"
    "'onsite_delivery','material_handover',"
    "'installation','acceptance','completed'"
)

_LEGACY_STAGES = (
    "'intake','assignment','survey','scm','onsite',"
    "'installation','acceptance','completed'"
)


def upgrade() -> None:
    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA)
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        TABLE,
        f"workflow_stage IN ({_STAGES})",
        schema=SCHEMA,
    )

    # Assignees
    op.add_column(
        TABLE,
        sa.Column("onsite_delivery_assignee_employee_id", sa.UUID(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column("material_handover_assignee_employee_id", sa.UUID(), nullable=True),
        schema=SCHEMA,
    )
    op.create_foreign_key(
        "fk_prj_site_onsite_delivery_assignee",
        TABLE,
        "master_employee",
        ["onsite_delivery_assignee_employee_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema="master",
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_prj_site_material_handover_assignee",
        TABLE,
        "master_employee",
        ["material_handover_assignee_employee_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema="master",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_prj_site_onsite_delivery_assignee",
        TABLE,
        ["onsite_delivery_assignee_employee_id"],
        schema=SCHEMA,
    )
    op.create_index(
        "ix_prj_site_material_handover_assignee",
        TABLE,
        ["material_handover_assignee_employee_id"],
        schema=SCHEMA,
    )

    for col, length in (
        ("onsite_delivery_attachment_name", 255),
        ("material_handover_attachment_name", 255),
        ("onsite_delivery_progress_status", 40),
        ("material_handover_progress_status", 40),
    ):
        op.add_column(
            TABLE,
            sa.Column(col, sa.String(length=length), nullable=True),
            schema=SCHEMA,
        )

    for col in ("onsite_delivery_remarks", "material_handover_remarks"):
        op.add_column(TABLE, sa.Column(col, sa.Text(), nullable=True), schema=SCHEMA)

    for col in (
        "onsite_delivery_assigned_date",
        "onsite_delivery_finished_date",
        "material_handover_assigned_date",
        "material_handover_finished_date",
    ):
        op.add_column(TABLE, sa.Column(col, sa.Date(), nullable=True), schema=SCHEMA)

    # Soft-copy legacy onsite tracking into onsite_delivery (no forced rewrite of business fields)
    op.execute(
        """
        UPDATE project.prj_site_installation
        SET onsite_delivery_assignee_employee_id = onsite_assignee_employee_id,
            onsite_delivery_assigned_date = onsite_assigned_date,
            onsite_delivery_finished_date = onsite_finished_date,
            onsite_delivery_attachment_name = onsite_attachment_name,
            onsite_delivery_progress_status = onsite_progress_status,
            onsite_delivery_remarks = onsite_remarks
        WHERE onsite_assignee_employee_id IS NOT NULL
           OR onsite_progress_status IS NOT NULL
           OR onsite_attachment_name IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_prj_site_material_handover_assignee", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_prj_site_onsite_delivery_assignee", table_name=TABLE, schema=SCHEMA)
    op.drop_constraint(
        "fk_prj_site_material_handover_assignee", TABLE, schema=SCHEMA, type_="foreignkey"
    )
    op.drop_constraint(
        "fk_prj_site_onsite_delivery_assignee", TABLE, schema=SCHEMA, type_="foreignkey"
    )

    for col in (
        "material_handover_finished_date",
        "material_handover_assigned_date",
        "onsite_delivery_finished_date",
        "onsite_delivery_assigned_date",
        "material_handover_remarks",
        "onsite_delivery_remarks",
        "material_handover_progress_status",
        "onsite_delivery_progress_status",
        "material_handover_attachment_name",
        "onsite_delivery_attachment_name",
        "material_handover_assignee_employee_id",
        "onsite_delivery_assignee_employee_id",
    ):
        op.drop_column(TABLE, col, schema=SCHEMA)

    op.execute(
        """
        UPDATE project.prj_site_installation
        SET workflow_stage = 'onsite'
        WHERE workflow_stage IN ('onsite_delivery', 'material_handover')
        """
    )

    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA)
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        TABLE,
        f"workflow_stage IN ({_LEGACY_STAGES})",
        schema=SCHEMA,
    )
