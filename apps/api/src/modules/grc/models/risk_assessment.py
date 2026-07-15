"""Risk assessment ORM per ERD_19 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskAssessment(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_assessment"
    __table_args__ = (
        UniqueConstraint("company_id", "assessment_number", name="uk_grc_risk_assessment_number"),
        CheckConstraint("impact IS NULL OR (impact BETWEEN 1 AND 5)", name="ck_grc_ras_impact"),
        CheckConstraint(
            "probability IS NULL OR (probability BETWEEN 1 AND 5)",
            name="ck_grc_ras_probability",
        ),
        CheckConstraint(
            "risk_level IS NULL OR risk_level IN ('low','medium','high','critical')",
            name="ck_grc_ras_level",
        ),
        CheckConstraint(
            "status IN ('draft','completed','archived')",
            name="ck_grc_risk_assessment_status",
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
    assessment_number: Mapped[str] = mapped_column(String(50), nullable=False)

    assessed_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    assessment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
