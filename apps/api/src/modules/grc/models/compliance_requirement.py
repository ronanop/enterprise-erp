"""Compliance requirement ORM per ERD_19 section 6.11."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcComplianceRequirement(Base, *GrcMasterMixin):
    __tablename__ = "grc_compliance_requirement"
    __table_args__ = (
        UniqueConstraint(
            "framework_id", "requirement_code",
            name="uk_grc_compliance_requirement_code",
        ),
        CheckConstraint(
            "compliance_area IN ('tax','labor','financial','info_security',"
            "'environmental','industry','other')",
            name="ck_grc_compliance_area",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_grc_compliance_req_status"),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    framework_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_compliance_framework.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requirement_code: Mapped[str] = mapped_column(String(50), nullable=False)
    requirement_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance_area: Mapped[str | None] = mapped_column(String(40), nullable=True)

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
