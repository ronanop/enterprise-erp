"""Add attachment source (upload / link / cloud) for CRM files."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0453_crm_attachment_source"
down_revision: str | None = "0452_crm_meeting_tagged"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_attachment",
        sa.Column(
            "source",
            sa.String(length=30),
            nullable=False,
            server_default="upload",
        ),
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_attachment_source",
        "crm_attachment",
        "source IN ('upload','link','google_drive','onedrive','dropbox','box')",
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_attachment_source", "crm_attachment", schema="crm", type_="check")
    op.drop_column("crm_attachment", "source", schema="crm")
