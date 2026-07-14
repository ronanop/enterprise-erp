"""CRM customer satisfaction ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmCustomerSatisfaction(Base, *CrmMasterMixin):
    __tablename__ = "crm_customer_satisfaction"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_crm_csat_status"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    score_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    score_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    csat_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    nps_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    survey_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quality_satisfaction_ref_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
