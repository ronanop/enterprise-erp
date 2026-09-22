"""Exit agreement ORM - NOC, NDA and non-solicit signed on the system."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrExitAgreement(Base, *HrTransactionMixin):
    """One signed undertaking attached to a separation.

    ``body_text`` holds the exact wording shown to the employee and
    ``body_sha256`` fingerprints it, so the signed version can be proved later
    even if the template changes.
    """

    __tablename__ = "hr_exit_agreement"
    __table_args__ = (
        UniqueConstraint(
            "separation_id", "agreement_type", name="uk_hr_exit_agreement_sep_type"
        ),
        CheckConstraint(
            "agreement_type IN ('noc','nda','non_solicit')",
            name="ck_hr_exit_agreement_type",
        ),
        CheckConstraint(
            "status IN ('issued','signed','declined','void')",
            name="ck_hr_exit_agreement_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    separation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_separation.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agreement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    body_sha256: Mapped[str] = mapped_column(String(64), nullable=False)

    # Non-solicit only: how long the restriction runs, and when it ends.
    restriction_months: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    restriction_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="issued", index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issued_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    signature_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signature_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    signature_user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decline_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
