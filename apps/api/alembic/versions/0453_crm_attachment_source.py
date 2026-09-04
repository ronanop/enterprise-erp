"""Add attachment source (upload / link / cloud) for CRM files."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0453_crm_attachment_source"
down_revision: str | None = "0452_crm_meeting_tagged"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_attachment",
        sa.Column(
            "source",
            sa.String(length=30),
            nullable=False,
            server_default="upload",
        ),
        schema="crm",
    )
    bind = op.get_bind()
    existing = {
        c["name"]
        for c in inspect(bind).get_check_constraints("crm_attachment", schema="crm")
    }
    if "ck_crm_attachment_source" not in existing:
        op.create_check_constraint(
            "ck_crm_attachment_source",
            "crm_attachment",
            "source IN ('upload','link','google_drive','onedrive','dropbox','box')",
            schema="crm",
        )


def downgrade() -> None:
    op.drop_constraint("ck_crm_attachment_source", "crm_attachment", schema="crm", type_="check")
    op.drop_column("crm_attachment", "source", schema="crm")
