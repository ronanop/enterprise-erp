"""Risk treatment ORM per ERD_19 section 6.9."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskTreatment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_treatment"
    __table_args__ = (
        UniqueConstraint("company_id", "treatment_number", name="uk_grc_risk_treatment_number"),
        CheckConstraint(
            "treatment_strategy IN ('accept','avoid','reduce','transfer')",
            name="ck_grc_treatment_strategy",
        ),
        CheckConstraint(
            "status IN ('draft','planned','in_progress','completed','deferred','cancelled')",
            name="ck_grc_risk_treatment_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_register.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    treatment_number: Mapped[str] = mapped_column(String(50), nullable=False)
    treatment_strategy: Mapped[str] = mapped_column(String(30), nullable=False)
    action_plan: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    control_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
