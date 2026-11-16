"""Admin-managed Mode / Category dropdown options for service tickets."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.service.models.mixins import SvcMasterMixin


class SvcTicketOption(Base, *SvcMasterMixin):
    __tablename__ = "svc_ticket_option"
    __table_args__ = (
        UniqueConstraint("company_id", "option_type", "option_code", name="uk_svc_ticket_option_code"),
        CheckConstraint("option_type IN ('mode','category')", name="ck_svc_ticket_option_type"),
        CheckConstraint("status IN ('active','inactive')", name="ck_svc_ticket_option_status"),
        {"schema": "service"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    option_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    option_code: Mapped[str] = mapped_column(String(80), nullable=False)
    option_label: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
