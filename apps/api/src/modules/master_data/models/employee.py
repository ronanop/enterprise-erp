"""Employee master ORM model."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, String, UniqueConstraint, event
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.master_data.models.mixins import MasterBranchRecordMixin
from security.encrypted_types import EncryptedString
from security.field_crypto import pii_lookup


class MasterEmployee(Base, *MasterBranchRecordMixin):
    __tablename__ = "master_employee"
    __table_args__ = (
        UniqueConstraint("company_id", "employee_code", name="uk_master_employee_company_code"),
        UniqueConstraint("company_id", "email_lookup", name="uk_master_employee_company_email"),
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
    email: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    email_lookup: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mobile: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    mobile_lookup: Mapped[str] = mapped_column(String(64), nullable=False)
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
    is_hiring_manager: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_recruiter: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_hr: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    reporting_manager: Mapped["MasterEmployee | None"] = relationship(
        remote_side="MasterEmployee.id",
        foreign_keys=[reporting_manager_id],
    )


def _stamp_contact_lookups(_mapper, _connection, target: MasterEmployee) -> None:
    email_key = pii_lookup(target.email)
    mobile_key = pii_lookup(target.mobile)
    if email_key:
        target.email_lookup = email_key
    if mobile_key:
        target.mobile_lookup = mobile_key


event.listen(MasterEmployee, "before_insert", _stamp_contact_lookups)
event.listen(MasterEmployee, "before_update", _stamp_contact_lookups)
