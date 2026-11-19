"""HR KPI definition ORM — department KPI library (PMS)."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrDetailMixin


class HrKpi(Base, *HrDetailMixin):
    __tablename__ = "hr_kpi"
    __table_args__ = (
        CheckConstraint(
            "measure_type IN ('percentage','number','currency','rating')",
            name="ck_hr_kpi_measure",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_kpi_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    weightage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    target: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    measure_type: Mapped[str] = mapped_column(String(30), nullable=False, default="number")
    rating_scale: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
