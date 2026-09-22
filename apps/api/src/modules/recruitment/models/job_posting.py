"""Job posting ORM per ERD_13 §6.2."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.recruitment.models.mixins import RecDetailMixin


class RecJobPosting(Base, *RecDetailMixin):
    __tablename__ = "rec_job_posting"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_rec_post_company_doc"),
        CheckConstraint(
            "channel IN ('internal','career_site','job_board','agency','referral','campus','other')",
            name="ck_rec_post_channel",
        ),
        CheckConstraint(
            "status IN ('draft','published','paused','closed','cancelled')",
            name="ck_rec_post_status",
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

    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    job_requisition_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("recruitment.rec_job_requisition.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    posting_title: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    # UUID ref - no FK here: rec_recruitment_source is created after this table (ERD §15 0203→0204)
    recruitment_source_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    publish_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    publish_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    crm_campaign_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
