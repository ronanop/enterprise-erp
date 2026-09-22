"""Store service ticket attachment bytes in PostgreSQL (pgAdmin-visible)."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0596_svc_attachment_bytes"
down_revision: str | None = "0595_svc_mail_parse_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "svc_service_request_attachment",
        sa.Column("file_content", postgresql.BYTEA(), nullable=True),
        schema="service",
    )
    # Keep file_path for legacy rows; new uploads may store a synthetic db:// marker.
    op.alter_column(
        "svc_service_request_attachment",
        "file_path",
        existing_type=sa.String(1000),
        nullable=True,
        schema="service",
    )

    # Best-effort backfill from local disk paths into BYTEA
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, file_path FROM service.svc_service_request_attachment "
            "WHERE file_content IS NULL AND file_path IS NOT NULL AND is_deleted = false"
        )
    ).fetchall()
    for row_id, file_path in rows:
        if not file_path:
            continue
        path = Path(str(file_path))
        if not path.is_file():
            continue
        try:
            data = path.read_bytes()
        except OSError:
            continue
        bind.execute(
            sa.text(
                "UPDATE service.svc_service_request_attachment "
                "SET file_content = :data WHERE id = :id"
            ),
            {"data": data, "id": row_id},
        )


def downgrade() -> None:
    op.alter_column(
        "svc_service_request_attachment",
        "file_path",
        existing_type=sa.String(1000),
        nullable=False,
        schema="service",
    )
    op.drop_column("svc_service_request_attachment", "file_content", schema="service")
