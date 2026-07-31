"""HR employment ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrEmployment(Base, *HrTransactionMixin):
    __tablename__ = "hr_employment"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hr_empl_company_doc"),
        CheckConstraint(
            "employment_type IN ('permanent','contract','intern','consultant')",
            name="ck_hr_empl_type",
        ),
        CheckConstraint(
            "status IN ('draft','onboarding','active','probation','confirmed',"
            "'notice_period','separated','ex_employee','ended','cancelled')",
            name="ck_hr_empl_status",
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
    employment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    probation_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    probation_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    confirmation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notice_period_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ctc_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    work_location_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lifecycle_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payroll_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
