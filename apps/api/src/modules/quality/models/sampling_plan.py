"""Quality sampling plan ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin


class QmSamplingPlan(Base, *QmMasterMixin):
    __tablename__ = "qm_sampling_plan"
    __table_args__ = (
        UniqueConstraint("company_id", "sampling_code", name="uk_qm_smp_company_code"),
        CheckConstraint("sample_size > 0", name="ck_qm_smp_sample_size"),
        CheckConstraint("reject_count >= accept_count", name="ck_qm_smp_reject_ge_accept"),
        CheckConstraint("status IN ('active','inactive')", name="ck_qm_smp_status"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    sampling_code: Mapped[str] = mapped_column(String(50), nullable=False)
    sampling_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lot_size_from: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    lot_size_to: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    sample_size: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    accept_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    reject_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    aql_percent: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
