"""Issued company asset held by an employee (standalone HRMS, hr schema)."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrEmployeeAsset(Base, *HrTransactionMixin):
    __tablename__ = "hr_employee_asset"
    __table_args__ = (
        UniqueConstraint("company_id", "asset_code", name="uk_hr_emp_asset_code"),
        CheckConstraint(
            "status IN ('active','returned','available')",
            name="ck_hr_emp_asset_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    asset_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_return_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def asset_name(self) -> str:
        return self.name

    @property
    def asset_type(self) -> str:
        return self.category

    @property
    def qr_code(self) -> None:
        return None

    @property
    def barcode(self) -> None:
        return None
