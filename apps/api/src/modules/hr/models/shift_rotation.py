"""Shift rotation schedule ORM."""

import json
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrDetailMixin


class HrShiftRotation(Base, *HrDetailMixin):
    __tablename__ = "hr_shift_rotation"
    __table_args__ = (
        UniqueConstraint("company_id", "rotation_code", name="uk_hr_shift_rotation_code"),
        CheckConstraint("cycle IN ('weekly','biweekly','monthly')", name="ck_hr_shift_rot_cycle"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_shift_rot_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    rotation_code: Mapped[str] = mapped_column(String(50), nullable=False)
    rotation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cycle: Mapped[str] = mapped_column(String(30), nullable=False, default="weekly")
    sequence_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    employee_ids_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)

    def sequence_list(self) -> list[str]:
        try:
            return list(json.loads(self.sequence_json or "[]"))
        except Exception:
            return []

    def employee_id_list(self) -> list[str]:
        try:
            return list(json.loads(self.employee_ids_json or "[]"))
        except Exception:
            return []
