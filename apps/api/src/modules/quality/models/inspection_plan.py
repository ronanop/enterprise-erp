"""Quality inspection plan ORM."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin

if TYPE_CHECKING:
    from modules.quality.models.characteristic import QmQualityCharacteristic


class QmInspectionPlan(Base, *QmMasterMixin):
    __tablename__ = "qm_inspection_plan"
    __table_args__ = (
        UniqueConstraint("company_id", "plan_code", name="uk_qm_plan_company_code"),
        CheckConstraint(
            "inspection_type IN ('incoming','in_process','final','customer_return')",
            name="ck_qm_plan_type",
        ),
        CheckConstraint(
            "status IN ('draft','active','obsolete')",
            name="ck_qm_plan_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    plan_code: Mapped[str] = mapped_column(String(50), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    product_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inspection_type: Mapped[str] = mapped_column(String(30), nullable=False)
    sampling_plan_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_sampling_plan.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    characteristics: Mapped[list[QmQualityCharacteristic]] = relationship(
        back_populates="inspection_plan"
    )
