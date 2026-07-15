"""Control ORM per ERD_19 section 6.4."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcMasterMixin


class GrcControl(Base, *GrcMasterMixin):
    __tablename__ = "grc_control"
    __table_args__ = (
        UniqueConstraint("company_id", "control_number", name="uk_grc_control_number"),
        UniqueConstraint("company_id", "control_code", name="uk_grc_control_code"),
        CheckConstraint(
            "control_type IN ('preventive','detective','corrective','compensating')",
            name="ck_grc_control_type",
        ),
        CheckConstraint(
            "frequency IN ('continuous','daily','weekly','monthly','quarterly','annual','ad_hoc')",
            name="ck_grc_control_frequency",
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive','retired')",
            name="ck_grc_control_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    control_number: Mapped[str] = mapped_column(String(50), nullable=False)
    control_code: Mapped[str] = mapped_column(String(50), nullable=False)
    control_name: Mapped[str] = mapped_column(String(255), nullable=False)
    control_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "grc.grc_risk_register.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_grc_control_risk",
        ),
        nullable=True,
        index=True,
    )
    frequency: Mapped[str | None] = mapped_column(String(30), nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
