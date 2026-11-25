"""Create all ERD_01 foundation tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

import modules.foundation.models  # noqa: F401
from database.base import Base

revision: str = "0003_foundation_tables"
down_revision: str | None = "0002_create_schemas"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_FOUNDATION_SCHEMAS = frozenset({"foundation", "audit", "config"})


def _fk_target_schema(fk) -> str | None:
    """Best-effort schema from FK target (e.g. master.master_employee.id)."""
    ref = getattr(fk, "target_fullname", None) or str(fk)
    if isinstance(ref, str) and "." in ref:
        return ref.split(".", 1)[0]
    return None


def _has_external_fk(table) -> bool:
    """Skip tables that FK outside foundation/audit/config (created later)."""
    for fk in table.foreign_keys:
        schema = _fk_target_schema(fk)
        if schema and schema not in _FOUNDATION_SCHEMAS:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()
    for table in Base.metadata.sorted_tables:
        if table.schema in _FOUNDATION_SCHEMAS and not _has_external_fk(table):
            table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(Base.metadata.sorted_tables):
        if table.schema in _FOUNDATION_SCHEMAS and not _has_external_fk(table):
            table.drop(bind=bind, checkfirst=True)
