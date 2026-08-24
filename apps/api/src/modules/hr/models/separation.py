"""HR separation ORM."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrSeparation(Base, *HrTransactionMixin):
    __tablename__ = "hr_separation"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hr_sep_company_doc"),
        CheckConstraint(
            "separation_type IN ('resignation','termination','retirement')",
            name="ck_hr_sep_type",
        ),
        CheckConstraint(
            "status IN ("
            "'draft','submitted','manager_approved','it_approved','accounts_approved',"
            "'hr_approved','completed','cancelled'"
            ")",
            name="ck_hr_sep_status",
        ),
        CheckConstraint(
            "fnf_status IN ('pending','prepared','calculated','settled','waived')",
            name="ck_hr_sep_fnf_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    separation_type: Mapped[str] = mapped_column(String(30), nullable=False)
    requested_last_working_date: Mapped[date] = mapped_column(Date, nullable=False)
    approved_last_working_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
    clearance_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    fnf_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    fnf_payroll_run_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payroll.pay_payroll_run.id", ondelete="SET NULL"),
        nullable=True,
    )
