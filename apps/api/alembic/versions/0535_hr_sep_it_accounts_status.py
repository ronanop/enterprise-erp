"""Widen hr_separation status for IT and Accounts approval stages."""

from collections.abc import Sequence

from alembic import op

revision: str = "0535_hr_sep_it_accounts_status"
down_revision: str | None = "0534_hr_seed_locations_v2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_hr_sep_status", "hr_separation", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_sep_status",
        "hr_separation",
        "status IN ("
        "'draft','submitted','manager_approved','it_approved','accounts_approved',"
        "'hr_approved','completed','cancelled'"
        ")",
        schema="hr",
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE hr.hr_separation
        SET status = 'manager_approved'
        WHERE status IN ('it_approved', 'accounts_approved')
        """
    )
    op.drop_constraint("ck_hr_sep_status", "hr_separation", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_sep_status",
        "hr_separation",
        "status IN ('draft','submitted','manager_approved','hr_approved','completed','cancelled')",
        schema="hr",
    )
