"""Field engineer visit details for onsite service requests."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, CompanyMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class SvcServiceFieldEngineerVisit(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "svc_service_field_engineer_visit"
    __table_args__ = ({"schema": "service"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    engineer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    engineer_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    distance: Mapped[str | None] = mapped_column(String(100), nullable=True)
    visits_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    carrying_spares: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    visit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    hw_replacement: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transport_mode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    movement_charges: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    visit_charges: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_charges: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_approval: Mapped[str | None] = mapped_column(String(50), nullable=True)
