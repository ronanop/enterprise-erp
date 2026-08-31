"""Add server defaults for ast_assignment_component created_at/updated_at.

Migration 0492 created NOT NULL timestamp columns without DB defaults.
ORM AuditMixin expects server_default=now(), so INSERTs omit the columns and
Postgres stores NULL → NotNullViolation on assignment component create.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0567_ast_assignment_component_timestamps"
down_revision: str | None = "0566_ast_assignment_dc_signature"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Align with other asset transactional tables (e.g. ast_asset_assignment).
    op.alter_column(
        "ast_assignment_component",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        existing_nullable=False,
        schema="asset",
    )
    op.alter_column(
        "ast_assignment_component",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        existing_nullable=False,
        schema="asset",
    )


def downgrade() -> None:
    op.alter_column(
        "ast_assignment_component",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        existing_nullable=False,
        schema="asset",
    )
    op.alter_column(
        "ast_assignment_component",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        existing_nullable=False,
        schema="asset",
    )
