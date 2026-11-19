"""HR grade master ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrGrade(Base, *HrMasterMixin):
    __tablename__ = "hr_grade"
    __table_args__ = (
        UniqueConstraint("company_id", "grade_code", name="uk_hr_grade_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_grade_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    grade_code: Mapped[str] = mapped_column(String(50), nullable=False)
    grade_name: Mapped[str] = mapped_column(String(255), nullable=False)
    min_ctc: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    max_ctc: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
