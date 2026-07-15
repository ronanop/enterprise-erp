"""Risk register ORM per ERD_19 section 6.7."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcRiskRegister(Base, *GrcTransactionMixin):
    __tablename__ = "grc_risk_register"
    __table_args__ = (
        UniqueConstraint("company_id", "risk_number", name="uk_grc_risk_register_number"),
        CheckConstraint(
            "inherent_impact IS NULL OR (inherent_impact BETWEEN 1 AND 5)",
            name="ck_grc_risk_inherent_impact",
        ),
        CheckConstraint(
            "inherent_probability IS NULL OR (inherent_probability BETWEEN 1 AND 5)",
            name="ck_grc_risk_inherent_prob",
        ),
        CheckConstraint(
            "residual_impact IS NULL OR (residual_impact BETWEEN 1 AND 5)",
            name="ck_grc_risk_residual_impact",
        ),
        CheckConstraint(
            "residual_probability IS NULL OR (residual_probability BETWEEN 1 AND 5)",
            name="ck_grc_risk_residual_prob",
        ),
        CheckConstraint(
            "risk_level IS NULL OR risk_level IN ('low','medium','high','critical')",
            name="ck_grc_risk_level",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','open','mitigated','closed',"
            "'accepted','cancelled')",
            name="ck_grc_risk_register_status",
        ),
        Index("ix_grc_risk_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_grc_risk_next_review", "next_review_at"),
        Index("ix_grc_risk_category_id", "risk_category_id"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_number: Mapped[str] = mapped_column(String(50), nullable=False)
    risk_title: Mapped[str] = mapped_column(String(255), nullable=False)
    risk_category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_risk_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    inherent_impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inherent_probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inherent_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    residual_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(20), nullable=True)

    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    asset_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    crm_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    inventory_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    next_review_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

