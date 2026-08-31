"""HR employee profile ORM — extends master_employee (C-01)."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrEmployeeProfile(Base, *HrTransactionMixin):
    __tablename__ = "hr_employee_profile"
    __table_args__ = (
        UniqueConstraint("employee_id", name="uk_hr_profile_employee"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_profile_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    marital_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_mobile: Mapped[str | None] = mapped_column(String(30), nullable=True)
    permanent_address_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    current_address_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    aadhaar_number: Mapped[str | None] = mapped_column(String(12), nullable=True, index=True)
    pan_number: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    uan_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bank_ifsc: Mapped[str | None] = mapped_column(String(11), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_holder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    education_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    skills_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    face_auth_enabled: Mapped[bool] = mapped_column(nullable=False, default=False)
    face_auth_fingerprint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
