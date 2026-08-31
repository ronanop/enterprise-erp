"""ADR-REG-04: atomic asset document sequences with backfill."""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0538_ast_document_sequence"
down_revision: str | None = "0537_hr_sep_notice_exit_types"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_document_sequence"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("sequence_key", sa.String(length=32), nullable=False),
        sa.Column("next_value", sa.BigInteger(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "company_id",
            "sequence_key",
            name="uk_ast_document_sequence_key",
        ),
        schema=SCHEMA,
    )
    op.create_index(
        f"ix_{TABLE}_tenant_id",
        TABLE,
        ["tenant_id"],
        schema=SCHEMA,
    )
    op.create_index(
        f"ix_{TABLE}_company_id",
        TABLE,
        ["company_id"],
        schema=SCHEMA,
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT tenant_id, company_id, asset_code
            FROM asset.ast_asset
            WHERE is_deleted = false
              AND asset_code LIKE 'AST-____-%'
            """
        )
    ).fetchall()

    aggregates: dict[tuple, int] = {}
    for tenant_id, company_id, asset_code in rows:
        parts = str(asset_code).split("-")
        if len(parts) < 3:
            continue
        sequence_key = f"{parts[0]}-{parts[1]}"
        try:
            suffix = int(parts[2])
        except ValueError:
            continue
        key = (tenant_id, company_id, sequence_key)
        aggregates[key] = max(aggregates.get(key, 0), suffix)

    for (tenant_id, company_id, sequence_key), max_suffix in aggregates.items():
        bind.execute(
            sa.text(
                f"""
                INSERT INTO {SCHEMA}.{TABLE}
                    (id, tenant_id, company_id, sequence_key, next_value)
                VALUES (:id, :tenant_id, :company_id, :sequence_key, :next_value)
                """
            ),
            {
                "id": uuid4(),
                "tenant_id": tenant_id,
                "company_id": company_id,
                "sequence_key": sequence_key,
                "next_value": max_suffix + 1,
            },
        )


def downgrade() -> None:
    op.drop_table(TABLE, schema=SCHEMA)
