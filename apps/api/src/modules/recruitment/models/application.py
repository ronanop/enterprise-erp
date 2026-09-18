"""Application ORM per ERD_13 §6.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.recruitment.models.mixins import RecTransactionMixin


class RecApplication(Base, *RecTransactionMixin):
    __tablename__ = "rec_application"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_rec_app_company_doc"),
        CheckConstraint(
            "status IN ('active','rejected','offer_declined','backed_out','hired')",
            name="ck_rec_app_status",
        ),
        CheckConstraint(
            "current_stage_code IS NULL OR current_stage_code IN ("
            "'sourced','screening','interview_round_1','interview_round_2',"
            "'hr_discussion','background_check','offer_sent','offer_accepted')",
            name="ck_rec_app_current_stage_code",
        ),
        {"schema": "recruitment"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    candidate_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_candidate.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    job_requisition_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_job_requisition.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    job_posting_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_job_posting.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recruitment_source_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_recruitment_source.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recruiter_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_recruiter.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_stage_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    exited_at_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
