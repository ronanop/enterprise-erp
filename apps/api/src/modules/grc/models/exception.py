"""Exception ORM per ERD_19 section 6.17."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcException(Base, *GrcTransactionMixin):
    __tablename__ = "grc_exception"
    __table_args__ = (
        UniqueConstraint("company_id", "exception_number", name="uk_grc_exception_number"),
        CheckConstraint(
            "exception_type IN ('unauthorized_access','approval_bypass','process_violation',"
            "'security_exception','policy_deviation','other')",
            name="ck_grc_exception_type",
        ),
        CheckConstraint(
            "status IN ('draft','open','under_investigation','approved','rejected',"
            "'closed','expired')",
            name="ck_grc_exception_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    exception_number: Mapped[str] = mapped_column(String(50), nullable=False)
    exception_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    requested_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    approver_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
