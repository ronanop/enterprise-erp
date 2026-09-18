"""Application stage history ORM per ERD_13 §6.7."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.recruitment.models.mixins import RecDetailMixin


class RecApplicationStage(Base, *RecDetailMixin):
    __tablename__ = "rec_application_stage"
    __table_args__ = (
        CheckConstraint(
            "stage_code IN ("
            "'sourced','screening','interview_round_1','interview_round_2',"
            "'hr_discussion','background_check','offer_sent','offer_accepted')",
            name="ck_rec_app_stage_code",
        ),
        CheckConstraint(
            "status IN ('active','completed','skipped','cancelled')",
            name="ck_rec_app_stage_status",
        ),
        {"schema": "recruitment"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    application_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_application.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    stage_code: Mapped[str] = mapped_column(String(50), nullable=False)
    stage_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    changed_by_user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
