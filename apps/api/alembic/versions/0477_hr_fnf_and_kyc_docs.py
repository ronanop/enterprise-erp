"""FNF columns on separation; widen candidate document types; payroll target employee."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect

from helpers import add_column_if_missing, create_fk_if_missing  # noqa: E402

revision: str = "0477_hr_fnf_and_kyc_docs"
down_revision: str | None = "0476_hr_leave_adjustment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_separation",
        sa.Column("fnf_status", sa.String(30), nullable=False, server_default="pending"),
        schema="hr",
    )
    add_column_if_missing(
        "hr_separation",
        sa.Column("fnf_payroll_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="hr",
    )
    create_fk_if_missing(
        "fk_hr_separation_fnf_payroll_run",
        "hr_separation",
        "pay_payroll_run",
        ["fnf_payroll_run_id"],
        ["id"],
        source_schema="hr",
        referent_schema="payroll",
        ondelete="SET NULL",
    )
    bind = op.get_bind()
    checks = {c["name"] for c in inspect(bind).get_check_constraints("hr_separation", schema="hr")}
    if "ck_hr_sep_fnf_status" not in checks:
        op.create_check_constraint(
            "ck_hr_sep_fnf_status",
            "hr_separation",
            "fnf_status IN ('pending','prepared','calculated','settled','waived')",
            schema="hr",
        )

    add_column_if_missing(
        "pay_payroll_run",
        sa.Column(
            "target_employee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("master.master_employee.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="payroll",
    )

    op.drop_constraint("ck_rec_cand_doc_type", "rec_candidate_document", schema="recruitment")
    op.create_check_constraint(
        "ck_rec_cand_doc_type",
        "rec_candidate_document",
        "document_type IN ("
        "'identity','education','experience','portfolio','other',"
        "'photo','cancelled_cheque'"
        ")",
        schema="recruitment",
    )


def downgrade() -> None:
    op.drop_constraint("ck_rec_cand_doc_type", "rec_candidate_document", schema="recruitment")
    op.create_check_constraint(
        "ck_rec_cand_doc_type",
        "rec_candidate_document",
        "document_type IN ('identity','education','experience','portfolio','other')",
        schema="recruitment",
    )
    op.drop_column("pay_payroll_run", "target_employee_id", schema="payroll")
    op.drop_constraint("ck_hr_sep_fnf_status", "hr_separation", schema="hr")
    op.drop_column("hr_separation", "fnf_payroll_run_id", schema="hr")
    op.drop_column("hr_separation", "fnf_status", schema="hr")
