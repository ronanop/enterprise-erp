"""HR job level master ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrJobLevel(Base, *HrMasterMixin):
    __tablename__ = "hr_job_level"
    __table_args__ = (
        UniqueConstraint("company_id", "level_code", name="uk_hr_job_level_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_job_level_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    level_code: Mapped[str] = mapped_column(String(50), nullable=False)
    level_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rank_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
