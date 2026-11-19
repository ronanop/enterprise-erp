"""Customer + priority specific SLA policies (calendar or working-hours)."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.service.models.mixins import SvcMasterMixin


class SvcCustomerPrioritySla(Base, *SvcMasterMixin):
    __tablename__ = "svc_customer_priority_sla"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="ck_svc_customer_priority_sla_duration"),
        CheckConstraint(
            "calendar_type IN ('calendar','working')",
            name="ck_svc_customer_priority_sla_calendar",
        ),
        Index(
            "ix_svc_customer_priority_sla_lookup",
            "tenant_id",
            "company_id",
            "customer_id",
            "priority",
        ),
        {"schema": "service"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    priority: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    calendar_type: Mapped[str] = mapped_column(String(20), nullable=False, default="calendar")
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    escalation_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    # Optional link to a generic SLA definition (copied onto the ticket as sla_id)
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_sla.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
