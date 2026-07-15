"""Ticket category ORM per ERD_17 section 6.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketCategory(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_category"
    __table_args__ = (
        UniqueConstraint("company_id", "category_code", name="uk_hd_ticket_category_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_category_status",
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

    category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    default_priority_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_priority.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_category_default_priority",
        ),
        nullable=True,
        index=True,
    )
    default_sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_sla.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_category_default_sla",
        ),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
