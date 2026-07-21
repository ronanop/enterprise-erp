"""Fiscal year and period ORM models."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.finance.models.mixins import FinanceMasterMixin


class FinFiscalYear(Base, *FinanceMasterMixin):
    __tablename__ = "fin_fiscal_year"
    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year_code", name="uk_fin_fiscal_year_company_code"),
        CheckConstraint("end_date > start_date", name="ck_fin_fiscal_year_dates"),
        CheckConstraint(
            "status IN ('open','closed','archived')",
            name="ck_fin_fiscal_year_status",
        ),
        {"schema": "finance"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    fiscal_year_code: Mapped[str] = mapped_column(String(20), nullable=False)
    fiscal_year_name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="RESTRICT"),
        nullable=True,
    )

    periods: Mapped[list["FinPeriod"]] = relationship(back_populates="fiscal_year")


class FinPeriod(Base, *FinanceMasterMixin):
    __tablename__ = "fin_period"
    __table_args__ = (
        UniqueConstraint(
            "fiscal_year_id",
            "period_number",
            "branch_id",
            name="uk_fin_period_year_number",
        ),
        CheckConstraint("end_date >= start_date", name="ck_fin_period_dates"),
        CheckConstraint(
            "status IN ('open','soft_closed','hard_closed')",
            name="ck_fin_period_status",
        ),
        {"schema": "finance"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    fiscal_year_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("finance.fin_fiscal_year.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    period_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
    ar_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ap_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    inventory_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    payroll_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    gl_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    fiscal_year: Mapped[FinFiscalYear] = relationship(back_populates="periods")
