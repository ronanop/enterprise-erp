"""HR OKR objective + key-result ORM (PMS)."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.hr.models.mixins import HrDetailMixin


class HrOkr(Base, *HrDetailMixin):
    __tablename__ = "hr_okr"
    __table_args__ = (
        CheckConstraint("status IN ('active','inactive','closed')", name="ck_hr_okr_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    department: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    weightage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    progress_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)

    key_results: Mapped[list["HrOkrKeyResult"]] = relationship(
        "HrOkrKeyResult",
        back_populates="okr",
        cascade="all, delete-orphan",
        order_by="HrOkrKeyResult.sequence_no",
    )


class HrOkrKeyResult(Base, *HrDetailMixin):
    __tablename__ = "hr_okr_key_result"
    __table_args__ = (
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_okr_kr_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    okr_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_okr.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    progress_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    weightage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("1"))
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    okr: Mapped[HrOkr] = relationship("HrOkr", back_populates="key_results")
