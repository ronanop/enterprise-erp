"""Add posting audience (internal/external) and approval-email evidence on job requisitions."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0657_rec_job_posting_audience_evidence"
down_revision: str | None = "0656_hr_bio_k40_comm"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SCHEMA = "recruitment"
_TABLE = "rec_job_requisition"


def upgrade() -> None:
    bind = op.get_bind()
    if not column_exists(bind, _TABLE, "posting_audience", schema=_SCHEMA):
        op.add_column(
            _TABLE,
            sa.Column(
                "posting_audience",
                sa.String(20),
                nullable=False,
                server_default="external",
            ),
            schema=_SCHEMA,
        )
    if not column_exists(bind, _TABLE, "evidence_email_file_name", schema=_SCHEMA):
        op.add_column(
            _TABLE,
            sa.Column("evidence_email_file_name", sa.String(255), nullable=True),
            schema=_SCHEMA,
        )
    if not column_exists(bind, _TABLE, "evidence_email_path", schema=_SCHEMA):
        op.add_column(
            _TABLE,
            sa.Column("evidence_email_path", sa.String(500), nullable=True),
            schema=_SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    for name in ("evidence_email_path", "evidence_email_file_name", "posting_audience"):
        if column_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.drop_column(_TABLE, name, schema=_SCHEMA)
