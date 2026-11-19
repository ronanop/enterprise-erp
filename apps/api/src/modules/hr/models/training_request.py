"""HR training / meeting request ORM."""

from datetime import date, time
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrTrainingRequest(Base, *HrTransactionMixin):
    """Meeting / training booking request with attendees and approval."""

    __tablename__ = "hr_training_request"
    __table_args__ = (
        UniqueConstraint("company_id", "request_code", name="uk_hr_trn_req_company_code"),
        CheckConstraint(
            "request_type IN ('training','meeting','workshop')",
            name="ck_hr_trn_req_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled')",
            name="ck_hr_trn_req_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    request_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    request_type: Mapped[str] = mapped_column(String(30), nullable=False, default="meeting")
    requested_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    host_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    host_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    room_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_training_room.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    training_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_training.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    request_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attendees_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="submitted", index=True)
