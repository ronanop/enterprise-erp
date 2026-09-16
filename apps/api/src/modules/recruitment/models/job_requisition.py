"""Job requisition ORM per ERD_13 §6.1."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.recruitment.models.mixins import RecTransactionMixin


class RecJobRequisition(Base, *RecTransactionMixin):
    __tablename__ = "rec_job_requisition"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_rec_req_company_doc"),
        CheckConstraint("openings_count > 0", name="ck_rec_req_openings"),
        CheckConstraint("filled_count >= 0", name="ck_rec_req_filled_nonneg"),
        CheckConstraint("filled_count <= openings_count", name="ck_rec_req_filled_le_openings"),
        CheckConstraint(
            "employment_type IN ('permanent','contract','intern','consultant')",
            name="ck_rec_req_employment_type",
        ),
        CheckConstraint(
            "priority IN ('low','medium','high','critical')",
            name="ck_rec_req_priority",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','open','on_hold','filled','closed','cancelled','rejected')",
            name="ck_rec_req_status",
        ),
        {"schema": "recruitment"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    requisition_title: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    designation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    employment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    openings_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    filled_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    hiring_manager_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # UUID ref - no FK here: rec_recruiter is created after this table (ERD §15 0202→0205)
    recruiter_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    target_hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    min_experience_years: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    max_experience_years: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    salary_band_min: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    salary_band_max: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

