"""Employee master ORM model."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.master_data.models.mixins import MasterBranchRecordMixin


class MasterEmployee(Base, *MasterBranchRecordMixin):
    __tablename__ = "master_employee"
    __table_args__ = (
        UniqueConstraint("company_id", "employee_code", name="uk_master_employee_company_code"),
        UniqueConstraint("company_id", "email", name="uk_master_employee_company_email"),
        CheckConstraint(
            "status IN ('draft','onboarding','active','probation','on_leave',"
            "'notice_period','resigned','terminated','ex_employee')",
            name="ck_master_employee_status",
        ),
        {"schema": "master"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    department_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_code: Mapped[str] = mapped_column(String(50), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    mobile: Mapped[str] = mapped_column(String(30), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    reporting_manager_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    date_of_leaving: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="RESTRICT"),
        nullable=True,
    )

    reporting_manager: Mapped["MasterEmployee | None"] = relationship(
        remote_side="MasterEmployee.id",
        foreign_keys=[reporting_manager_id],
    )
