"""Quality characteristic ORM."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin

if TYPE_CHECKING:
    from modules.quality.models.inspection_plan import QmInspectionPlan


class QmQualityCharacteristic(Base, *QmMasterMixin):
    __tablename__ = "qm_quality_characteristic"
    __table_args__ = (
        UniqueConstraint("company_id", "characteristic_code", name="uk_qm_char_company_code"),
        CheckConstraint(
            "characteristic_type IN ('numeric','pass_fail','text','visual')",
            name="ck_qm_char_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_qm_char_status"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    inspection_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_inspection_plan.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    characteristic_code: Mapped[str] = mapped_column(String(50), nullable=False)
    characteristic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    characteristic_type: Mapped[str] = mapped_column(String(30), nullable=False, default="numeric")
    uom_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_uom.id", ondelete="RESTRICT"),
        nullable=True,
    )
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)

    inspection_plan: Mapped[QmInspectionPlan | None] = relationship(back_populates="characteristics")
