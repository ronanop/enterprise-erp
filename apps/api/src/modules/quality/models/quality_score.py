"""Quality KPI score snapshot ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin


class QmQualityScore(Base, *QmMasterMixin):
    __tablename__ = "qm_quality_score"
    __table_args__ = (
        CheckConstraint(
            "score_dimension IN ('company','product','vendor','customer')",
            name="ck_qm_qs_dimension",
        ),
        CheckConstraint("status IN ('draft','published')", name="ck_qm_qs_status"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    score_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    score_dimension: Mapped[str] = mapped_column(String(30), nullable=False, default="company")
    dimension_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    first_pass_yield: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    defect_rate: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    rework_rate: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    complaint_rate: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    supplier_quality_score: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
