"""Compliance framework ORM per ERD_19 section 6.10."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcComplianceFramework(Base, *GrcMasterMixin):
    __tablename__ = "grc_compliance_framework"
    __table_args__ = (
        UniqueConstraint("company_id", "framework_code", name="uk_grc_compliance_framework_code"),
        CheckConstraint(
            "framework_type IN ('regulatory','standard','internal','contractual')",
            name="ck_grc_framework_type",
        ),
        CheckConstraint(
            "status IN ('active','inactive','retired')",
            name="ck_grc_compliance_framework_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    framework_code: Mapped[str] = mapped_column(String(50), nullable=False)
    framework_name: Mapped[str] = mapped_column(String(255), nullable=False)
    framework_type: Mapped[str] = mapped_column(String(40), nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
