"""Placeholder revision present in local DB (seed locations). No-op for graph continuity."""

from collections.abc import Sequence

revision: str = "0476_hr_seed_locations_v2"
down_revision: str | None = "0474_hr_employee_asset_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
