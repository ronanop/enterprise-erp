"""Support team ORM per ERD_17 section 6.15."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdSupportTeam(Base, *HdMasterMixin):
    __tablename__ = "hd_support_team"
    __table_args__ = (
        UniqueConstraint("company_id", "team_code", name="uk_hd_support_team_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_support_team_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    team_code: Mapped[str] = mapped_column(String(50), nullable=False)
    team_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
