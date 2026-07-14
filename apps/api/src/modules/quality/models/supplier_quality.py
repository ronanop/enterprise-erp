"""Quality supplier scorecard ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin


class QmSupplierQuality(Base, *QmMasterMixin):
    __tablename__ = "qm_supplier_quality"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_qm_sq_status"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    score_period_start: Mapped[date] = mapped_column(Date, nullable=False)
    score_period_end: Mapped[date] = mapped_column(Date, nullable=False)
    incoming_accept_rate: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    defect_rate: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    ncr_count: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
