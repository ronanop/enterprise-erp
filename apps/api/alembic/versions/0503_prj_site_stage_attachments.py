"""Add mandatory stage attachment file-name columns on site installation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0503_prj_site_stage_attachments"
down_revision: str | Sequence[str] | None = "0502_crm_lead_distributor_name_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    "survey_attachment_name",
    "scm_attachment_name",
    "installation_attachment_name",
    "acceptance_attachment_name",
)


def upgrade() -> None:
    for col in _COLUMNS:
        op.add_column(
            "prj_site_installation",
            sa.Column(col, sa.String(length=255), nullable=True),
            schema="project",
        )


def downgrade() -> None:
    for col in reversed(_COLUMNS):
        op.drop_column("prj_site_installation", col, schema="project")
